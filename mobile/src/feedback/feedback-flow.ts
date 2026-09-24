import type { FeedbackCapture } from './feedback-capture'
import { clampFeedbackComment, type FeedbackIntent } from './feedback-message'
import type { MobileReviewTerminalTab } from '../session/review-terminal-reply-schema'
import type { FeedbackComposedImage } from './markup-flatten'
import type { MarkupState } from './markup-model'

export type { FeedbackComposedImage }

export type FeedbackTargetPicker =
  | { kind: 'loading' }
  | { kind: 'ready'; terminals: MobileReviewTerminalTab[] }
  | { kind: 'error'; message: string; terminals: MobileReviewTerminalTab[] }

export type FeedbackComposer = {
  capture: FeedbackCapture
  /** The flattened, cropped output of markup (or the untouched capture): previewed and sent. */
  image: FeedbackComposedImage
  /** The drawing that made `image`, so "Edit markup" reopens it; null when markup was skipped. */
  markup: MarkupState | null
  comment: string
  intent: FeedbackIntent
  picker: FeedbackTargetPicker | null
  sending: boolean
  error: string | null
}

/**
 * Screenshot → thumbnail → markup → composer → delivered. Markup is the only state that holds the
 * viewport, which is what `feedbackFlowHoldsViewport` answers for the pane's touch gate. Markup
 * reopened from the composer keeps that composer in `returnTo`, so Cancel goes back to it.
 */
export type FeedbackFlowState =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'captured'; capture: FeedbackCapture }
  | {
      kind: 'markup'
      capture: FeedbackCapture
      seed: MarkupState | null
      returnTo: FeedbackComposer | null
    }
  | { kind: 'composing'; composer: FeedbackComposer }
  | { kind: 'delivered'; itemId: string; capture: FeedbackCapture }

export type FeedbackFlowAction =
  | { type: 'capture-started' }
  | { type: 'capture-failed' }
  | { type: 'captured'; capture: FeedbackCapture }
  | { type: 'open-markup' }
  | { type: 'edit-markup' }
  | { type: 'cancel-markup' }
  | { type: 'markup-done'; image: FeedbackComposedImage; markup: MarkupState | null }
  | { type: 'skip-markup' }
  | { type: 'set-comment'; comment: string }
  | { type: 'set-intent'; intent: FeedbackIntent }
  | { type: 'picker'; picker: FeedbackTargetPicker | null }
  | { type: 'send-started' }
  | { type: 'send-failed'; message: string }
  | { type: 'delivered'; itemId: string }
  | { type: 'dismiss' }

export const FEEDBACK_IDLE: FeedbackFlowState = { kind: 'idle' }

export function feedbackFlowReducer(
  state: FeedbackFlowState,
  action: FeedbackFlowAction
): FeedbackFlowState {
  switch (action.type) {
    case 'capture-started':
      return state.kind === 'idle' || state.kind === 'captured' || state.kind === 'delivered'
        ? { kind: 'capturing' }
        : state
    case 'capture-failed':
      return state.kind === 'capturing' ? FEEDBACK_IDLE : state
    case 'captured':
      return state.kind === 'capturing' ? { kind: 'captured', capture: action.capture } : state
    case 'open-markup':
      return state.kind === 'captured'
        ? { kind: 'markup', capture: state.capture, seed: null, returnTo: null }
        : state
    case 'edit-markup':
      return state.kind === 'composing' && !state.composer.sending
        ? {
            kind: 'markup',
            capture: state.composer.capture,
            seed: state.composer.markup,
            returnTo: { ...state.composer, picker: null, error: null }
          }
        : state
    case 'cancel-markup':
      if (state.kind !== 'markup') {
        return state
      }
      // Cancel drops this round of edits: back to the composer it came from, else the thumbnail.
      return state.returnTo
        ? { kind: 'composing', composer: state.returnTo }
        : { kind: 'captured', capture: state.capture }
    case 'markup-done':
      if (state.kind !== 'markup') {
        return state
      }
      return state.returnTo
        ? {
            kind: 'composing',
            composer: { ...state.returnTo, image: action.image, markup: action.markup }
          }
        : composing(state.capture, action.image, action.markup)
    case 'skip-markup':
      return state.kind === 'captured'
        ? composing(
            state.capture,
            {
              uri: state.capture.uri,
              width: state.capture.width,
              height: state.capture.height,
              markedUp: false
            },
            null
          )
        : state
    case 'set-comment':
      return patchComposer(state, { comment: clampFeedbackComment(action.comment) })
    case 'set-intent':
      return patchComposer(state, { intent: action.intent })
    case 'picker':
      return patchComposer(state, { picker: action.picker })
    case 'send-started':
      return patchComposer(state, { sending: true, error: null })
    case 'send-failed':
      return patchComposer(state, { sending: false, error: action.message })
    case 'delivered':
      return state.kind === 'composing'
        ? { kind: 'delivered', itemId: action.itemId, capture: state.composer.capture }
        : state
    case 'dismiss':
      return FEEDBACK_IDLE
  }
}

export function feedbackFlowHoldsViewport(state: FeedbackFlowState): boolean {
  return state.kind === 'markup'
}

/** Capture ids the flow still needs on disk. */
export function feedbackFlowCaptureIds(state: FeedbackFlowState): string[] {
  switch (state.kind) {
    case 'captured':
    case 'markup':
    case 'delivered':
      return [state.capture.id]
    case 'composing':
      return [state.composer.capture.id]
    case 'idle':
    case 'capturing':
      return []
  }
}

/** The file the composer previews and the send uploads: always the composed (flattened) image. */
export function feedbackComposerImageUri(composer: Pick<FeedbackComposer, 'image'>): string {
  return composer.image.uri
}

function composing(
  capture: FeedbackCapture,
  image: FeedbackComposedImage,
  markup: MarkupState | null
): FeedbackFlowState {
  return {
    kind: 'composing',
    composer: {
      capture,
      image,
      markup,
      comment: '',
      intent: 'change',
      picker: null,
      sending: false,
      error: null
    }
  }
}

function patchComposer(
  state: FeedbackFlowState,
  patch: Partial<FeedbackComposer>
): FeedbackFlowState {
  return state.kind === 'composing'
    ? { ...state, composer: { ...state.composer, ...patch } }
    : state
}
