import {
  buildMobileImagePastePayload,
  saveMobileClipboardImageAsTempFile
} from '../session/mobile-clipboard-image'
import type { MobileClipboardImageRpcSender } from '../session/mobile-clipboard-image-operations'
import { healMobileNativeChatStaleInput } from '../session/mobile-native-chat-stale-input'
import type { MobileNativeChatRpcSender } from '../session/mobile-native-chat-send'
import {
  reviewTerminalCreateRun,
  reviewTerminalListRead,
  reviewTerminalSendRun
} from '../session/mobile-review-terminal-operations'
import type { MobileReviewTerminalTab } from '../session/review-terminal-reply-schema'
import { interpretOrThrowRefusalMessage } from '../transport/rpc-refusal-message'
import { feedbackComposerImageUri, type FeedbackComposer } from './feedback-flow'

const BRACKETED_PASTE_START = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'

/**
 * Wait between the paste and Enter. The desktop's own agent-prompt path waits 500 ms plus the
 * paste's ingest time before submitting (src/shared/agent-prompt-injection.ts), because an Enter
 * that lands mid-paste submits a half message and an image path the agent has not attached yet.
 * The phone cannot see the agent's input line, so it keeps the same open-loop budget.
 */
export const FEEDBACK_SUBMIT_SETTLE_MS = 600
const FEEDBACK_PASTE_INGEST_BYTES_PER_MS = 4096

export type FeedbackRpcSender = MobileClipboardImageRpcSender &
  Parameters<typeof reviewTerminalSendRun.request>[0] &
  MobileNativeChatRpcSender

export type FeedbackSendDeps = {
  client: FeedbackRpcSender
  /** The flattened PNG as base64, read off the phone's cache file. */
  readImageBase64: () => Promise<string>
  connectionId: string | null
  sleep: (ms: number) => Promise<void>
}

export type FeedbackTerminalTarget = Pick<MobileReviewTerminalTab, 'terminal' | 'title'> & {
  agent?: string
}

/**
 * The send's deps for one composer: the upload reads the composer's composed image (markup
 * flattened and cropped), the same file the composer previews, never the raw capture.
 */
export function feedbackSendDepsFor(
  composer: Pick<FeedbackComposer, 'image'>,
  io: {
    client: FeedbackRpcSender
    readImageBase64: (uri: string) => Promise<string>
    connectionId: string | null
    sleep: (ms: number) => Promise<void>
  }
): FeedbackSendDeps {
  const uri = feedbackComposerImageUri(composer)
  return {
    client: io.client,
    readImageBase64: () => io.readImageBase64(uri),
    connectionId: io.connectionId,
    sleep: io.sleep
  }
}

export function feedbackSubmitDelayMs(payload: string): number {
  return FEEDBACK_SUBMIT_SETTLE_MS + Math.ceil(payload.length / FEEDBACK_PASTE_INGEST_BYTES_PER_MS)
}

/**
 * The bytes typed into the agent: the markdown as one bracketed paste, then the host image path
 * as a second, so the agent sees a path paste and attaches the image as it does a desktop paste.
 */
export function buildFeedbackTerminalText(
  markdown: string,
  hostImagePath: string | null,
  agent?: string | null
): string {
  const body = `${BRACKETED_PASTE_START}${markdown.split('\x1b').join('␛')}${BRACKETED_PASTE_END}`
  return hostImagePath ? `${body} ${buildMobileImagePastePayload(hostImagePath, agent)}` : body
}

/** The same message as plain text for the clipboard, with the host path written out. */
export function buildFeedbackClipboardText(markdown: string, hostImagePath: string | null) {
  return hostImagePath
    ? `${markdown} ${hostImagePath}`
    : `${markdown} (not uploaded: the phone was offline)`
}

/** Uploads the flattened image over the chunked clipboard upload and answers the host temp path. */
export async function uploadFeedbackImage(deps: FeedbackSendDeps): Promise<string> {
  const base64 = await deps.readImageBase64()
  return saveMobileClipboardImageAsTempFile(deps.client, base64, {
    connectionId: deps.connectionId
  })
}

/**
 * Upload, paste, settle, Enter. Returns the host path the agent was handed. Throws with the
 * reason on any refusal; nothing is typed until the upload has answered a path.
 */
export async function deliverFeedbackToTerminal(
  target: FeedbackTerminalTarget,
  markdown: string,
  deps: FeedbackSendDeps
): Promise<{ hostImagePath: string }> {
  const hostImagePath = await uploadFeedbackImage(deps)
  // Same guard the review-notes send runs: a paste the native chat left on this terminal's
  // input line would otherwise be submitted along with the feedback.
  if (
    !(await healMobileNativeChatStaleInput({
      client: deps.client,
      terminal: target.terminal,
      deviceToken: null
    }))
  ) {
    throw new Error('Failed to send feedback')
  }
  const text = buildFeedbackTerminalText(markdown, hostImagePath, target.agent)
  await sendOrThrow(deps.client, { terminal: target.terminal, text, enter: false })
  await deps.sleep(feedbackSubmitDelayMs(text))
  await sendOrThrow(deps.client, { terminal: target.terminal, enter: true })
  return { hostImagePath }
}

async function sendOrThrow(
  client: FeedbackRpcSender,
  params: { terminal: string; text?: string; enter: boolean }
): Promise<void> {
  const response = await reviewTerminalSendRun.request(client, params)
  const accepted = interpretOrThrowRefusalMessage(
    () => reviewTerminalSendRun.interpret(response),
    'Failed to send feedback'
  )
  if (!accepted) {
    throw new Error('Terminal input is locked')
  }
}

/** A fresh agent terminal in the worktree, as the review-notes "New Agent Session" row makes. */
export async function createFeedbackTerminal(
  client: FeedbackRpcSender,
  worktreeId: string
): Promise<FeedbackTerminalTarget> {
  const response = await reviewTerminalCreateRun.request(client, {
    worktree: `id:${worktreeId}`,
    activate: false,
    select: true,
    navigation: 'caller'
  })
  return interpretOrThrowRefusalMessage(
    () => reviewTerminalCreateRun.interpret(response),
    'Failed to create terminal'
  )
}

export async function listFeedbackTerminals(
  client: FeedbackRpcSender,
  worktreeId: string
): Promise<MobileReviewTerminalTab[]> {
  const response = await reviewTerminalListRead.request(client, { worktree: `id:${worktreeId}` })
  return interpretOrThrowRefusalMessage(
    () => reviewTerminalListRead.interpret(response),
    'Unable to load agent sessions'
  )
}
