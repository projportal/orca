import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
  type RefObject
} from 'react'
import type { View } from 'react-native'
import type { RpcClient } from '../transport/rpc-client'
import { agentTargetLabel } from '../components/agent-target-actions'
import { useClipboardWriter } from '../platform/clipboard'
import { triggerError, triggerSuccess } from '../platform/haptics'
import { saveBrowserFrameCapture, saveCaptureBase64, cleanFeedbackCache } from './feedback-capture'
import { readImageSizeFromBase64 } from './feedback-image-size'
import {
  FEEDBACK_IDLE,
  feedbackFlowCaptureIds,
  feedbackFlowReducer,
  type FeedbackComposer
} from './feedback-flow'
import { createFeedbackList, feedbackCommentPreview } from './feedback-list'
import {
  feedbackPageHeading,
  formatFeedbackMarkdown,
  type FeedbackHeader
} from './feedback-message'
import {
  captureFeedbackView,
  feedbackCaptureStore,
  readFeedbackDeviceInfo,
  readFeedbackImageBase64
} from './feedback-platform'
import {
  buildFeedbackClipboardText,
  createFeedbackTerminal,
  deliverFeedbackToTerminal,
  feedbackSendDepsFor,
  listFeedbackTerminals,
  uploadFeedbackImage,
  type FeedbackTerminalTarget
} from './feedback-send'
import type { MobileFeedbackPageContext } from './mobile-feedback-kit'

/** One list per app run, shared by every pane that can take a screenshot. */
export const mobileFeedbackList = createFeedbackList()

export function useMobileFeedbackList() {
  return useSyncExternalStore(mobileFeedbackList.subscribe, mobileFeedbackList.getSnapshot)
}

type Args = {
  client: RpcClient | null
  worktreeId: string
  getConnectionId: () => Promise<string | null>
  getPageContext: () => MobileFeedbackPageContext
  onToast: (message: string, durationMs?: number) => void
  /** Injected for the demo route and tests; production waits on a real timer. */
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useMobileFeedbackFlow(args: Args) {
  const [state, dispatch] = useReducer(feedbackFlowReducer, FEEDBACK_IDLE)
  const argsRef = useRef(args)
  argsRef.current = args
  const stateRef = useRef(state)
  stateRef.current = state
  const clipboard = useClipboardWriter()

  const keepIds = useCallback(
    () =>
      new Set([...feedbackFlowCaptureIds(stateRef.current), ...mobileFeedbackList.referencedIds()]),
    []
  )

  const runCapture = useCallback(
    async (save: () => Promise<Awaited<ReturnType<typeof saveBrowserFrameCapture>>>) => {
      dispatch({ type: 'capture-started' })
      try {
        const capture = await save()
        dispatch({ type: 'captured', capture })
      } catch (error) {
        dispatch({ type: 'capture-failed' })
        triggerError()
        argsRef.current.onToast(errorText(error, 'Screenshot failed'), 2000)
      }
    },
    []
  )

  const captureFrame = useCallback(
    (frameUri: string | null) => {
      if (!frameUri) {
        argsRef.current.onToast('No frame to capture yet', 1500)
        return
      }
      void runCapture(() =>
        saveBrowserFrameCapture(frameUri, feedbackCaptureStore, {
          now: Date.now(),
          keepIds: keepIds()
        })
      )
    },
    [keepIds, runCapture]
  )

  const captureView = useCallback(
    (view: RefObject<View | null>) => {
      void runCapture(async () => {
        const base64 = await captureFeedbackView(view)
        const size = readImageSizeFromBase64(base64)
        if (!size) {
          throw new Error('Could not read the screenshot size')
        }
        return saveCaptureBase64(
          { base64, format: 'png', size, source: 'html-preview' },
          feedbackCaptureStore,
          { now: Date.now(), keepIds: keepIds() }
        )
      })
    },
    [keepIds, runCapture]
  )

  const buildMessage = useCallback((composer: FeedbackComposer) => {
    const page = argsRef.current.getPageContext()
    const header: FeedbackHeader = { ...page, ...readFeedbackDeviceInfo() }
    return formatFeedbackMarkdown({
      header,
      intent: composer.intent,
      comment: composer.comment,
      image: composer.image
    })
  }, [])

  const sendDeps = useCallback(async (composer: FeedbackComposer) => {
    const { client } = argsRef.current
    if (!client) {
      throw new Error('Waiting for desktop...')
    }
    return feedbackSendDepsFor(composer, {
      client,
      readImageBase64: readFeedbackImageBase64,
      connectionId: await argsRef.current.getConnectionId(),
      sleep: argsRef.current.sleep ?? realSleep
    })
  }, [])

  const recordAttempt = useCallback((composer: FeedbackComposer) => {
    const now = Date.now()
    mobileFeedbackList.upsert({
      id: composer.capture.id,
      createdAt: composer.capture.createdAt,
      updatedAt: now,
      // The list shows what was sent: the marked-up, cropped image when there is one.
      thumbnailUri: composer.image.markedUp ? composer.image.uri : composer.capture.thumbnailUri,
      pageLabel: feedbackPageHeading(argsRef.current.getPageContext().pageUrl),
      intent: composer.intent,
      commentPreview: feedbackCommentPreview(composer.comment),
      status: 'sending',
      targetLabel: null,
      hostImagePath: null,
      error: null
    })
  }, [])

  const deliver = useCallback(
    async (
      resolveTarget: (deps: Awaited<ReturnType<typeof sendDeps>>) => Promise<FeedbackTerminalTarget>
    ) => {
      const current = stateRef.current
      if (current.kind !== 'composing' || current.composer.sending) {
        return
      }
      const composer = current.composer
      dispatch({ type: 'send-started' })
      recordAttempt(composer)
      try {
        const deps = await sendDeps(composer)
        const target = await resolveTarget(deps)
        const { hostImagePath } = await deliverFeedbackToTerminal(
          target,
          buildMessage(composer),
          deps
        )
        mobileFeedbackList.update(composer.capture.id, {
          status: 'delivered',
          targetLabel: agentTargetLabel(target),
          hostImagePath,
          updatedAt: Date.now()
        })
        dispatch({ type: 'delivered', itemId: composer.capture.id })
        triggerSuccess()
      } catch (error) {
        const message = errorText(error, 'Failed to send feedback')
        mobileFeedbackList.update(composer.capture.id, {
          status: 'failed',
          error: message,
          updatedAt: Date.now()
        })
        dispatch({ type: 'send-failed', message })
        triggerError()
      }
    },
    [buildMessage, recordAttempt, sendDeps]
  )

  const sendToTerminal = useCallback(
    (target: FeedbackTerminalTarget) => {
      dispatch({ type: 'picker', picker: null })
      void deliver(async () => target)
    },
    [deliver]
  )

  const sendToNewSession = useCallback(() => {
    dispatch({ type: 'picker', picker: null })
    void deliver((deps) => createFeedbackTerminal(deps.client, argsRef.current.worktreeId))
  }, [deliver])

  const copyFeedback = useCallback(async () => {
    const current = stateRef.current
    if (current.kind !== 'composing') {
      return
    }
    const composer = current.composer
    dispatch({ type: 'picker', picker: null })
    let hostImagePath: string | null = null
    try {
      hostImagePath = await uploadFeedbackImage(await sendDeps(composer))
    } catch {
      // Copy still works offline: the text goes to the pasteboard without an image path.
    }
    try {
      await clipboard.writeText(buildFeedbackClipboardText(buildMessage(composer), hostImagePath))
    } catch (error) {
      dispatch({ type: 'send-failed', message: errorText(error, 'Unable to copy the feedback') })
      return
    }
    recordAttempt(composer)
    mobileFeedbackList.update(composer.capture.id, {
      status: 'copied',
      hostImagePath,
      updatedAt: Date.now()
    })
    triggerSuccess()
    argsRef.current.onToast('Feedback copied', 1500)
    dispatch({ type: 'delivered', itemId: composer.capture.id })
  }, [buildMessage, clipboard, recordAttempt, sendDeps])

  const openPicker = useCallback(async () => {
    const { client, worktreeId } = argsRef.current
    if (!client) {
      dispatch({
        type: 'picker',
        picker: { kind: 'error', message: 'Waiting for desktop...', terminals: [] }
      })
      return
    }
    dispatch({ type: 'picker', picker: { kind: 'loading' } })
    try {
      const terminals = await listFeedbackTerminals(client, worktreeId)
      dispatch({ type: 'picker', picker: { kind: 'ready', terminals } })
    } catch (error) {
      dispatch({
        type: 'picker',
        picker: {
          kind: 'error',
          message: errorText(error, 'Unable to load agent sessions'),
          terminals: []
        }
      })
    }
  }, [])

  // Why: a pane that unmounts mid-flow leaves its capture behind; the next capture's cleanup
  // would get it too, this just does it without waiting.
  useEffect(
    () => () => {
      try {
        cleanFeedbackCache(feedbackCaptureStore, {
          now: Date.now(),
          keepIds: mobileFeedbackList.referencedIds()
        })
      } catch {
        // The page build has no cache directory; the OS reclaims the cache regardless.
      }
    },
    []
  )

  return {
    state,
    dispatch,
    captureFrame,
    captureView,
    openPicker,
    sendToTerminal,
    sendToNewSession,
    copyFeedback
  }
}

export type MobileFeedbackFlow = ReturnType<typeof useMobileFeedbackFlow>
