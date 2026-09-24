import { describe, expect, it, vi } from 'vitest'
import type { FeedbackCapture } from './feedback-capture'
import {
  FEEDBACK_IDLE,
  feedbackFlowCaptureIds,
  feedbackFlowHoldsViewport,
  feedbackFlowReducer,
  type FeedbackFlowAction,
  type FeedbackFlowState
} from './feedback-flow'
import {
  createFeedbackList,
  feedbackCommentPreview,
  feedbackStatusLabel,
  type FeedbackItem
} from './feedback-list'

const CAPTURE: FeedbackCapture = {
  id: 'fb-1-aaaaaa',
  createdAt: 1,
  source: 'browser-frame',
  format: 'jpeg',
  uri: 'file:///c/fb-1-aaaaaa.jpg',
  width: 1206,
  height: 2148,
  thumbnailUri: 'file:///c/fb-1-aaaaaa-thumb.jpg'
}

function run(actions: FeedbackFlowAction[], state: FeedbackFlowState = FEEDBACK_IDLE) {
  return actions.reduce(feedbackFlowReducer, state)
}

describe('feedback flow', () => {
  it('walks screenshot, markup, composer, delivered', () => {
    const image = { uri: 'file:///c/flat.png', width: 1206, height: 2148, markedUp: true }
    let state = run([{ type: 'capture-started' }, { type: 'captured', capture: CAPTURE }])
    expect(state.kind).toBe('captured')
    expect(feedbackFlowHoldsViewport(state)).toBe(false)

    state = feedbackFlowReducer(state, { type: 'open-markup' })
    expect(state.kind).toBe('markup')
    expect(feedbackFlowHoldsViewport(state)).toBe(true)

    state = run(
      [
        { type: 'markup-done', image },
        { type: 'set-comment', comment: 'x'.repeat(4100) },
        { type: 'set-intent', intent: 'question' }
      ],
      state
    )
    expect(feedbackFlowHoldsViewport(state)).toBe(false)
    expect(state).toMatchObject({
      kind: 'composing',
      composer: { image, intent: 'question', sending: false, error: null, picker: null }
    })
    expect(state.kind === 'composing' && state.composer.comment.length).toBe(4000)

    state = run([{ type: 'send-started' }, { type: 'send-failed', message: 'locked' }], state)
    expect(state).toMatchObject({ composer: { sending: false, error: 'locked' } })
    state = run([{ type: 'send-started' }, { type: 'delivered', itemId: 'fb-1-aaaaaa' }], state)
    expect(state).toEqual({ kind: 'delivered', itemId: 'fb-1-aaaaaa', capture: CAPTURE })
    expect(feedbackFlowCaptureIds(state)).toEqual(['fb-1-aaaaaa'])
  })

  it('returns to the thumbnail when markup is cancelled, and can skip markup', () => {
    const captured = run([{ type: 'capture-started' }, { type: 'captured', capture: CAPTURE }])
    expect(run([{ type: 'open-markup' }, { type: 'cancel-markup' }], captured)).toEqual(captured)
    expect(feedbackFlowReducer(captured, { type: 'skip-markup' })).toMatchObject({
      kind: 'composing',
      composer: { image: { uri: CAPTURE.uri, markedUp: false } }
    })
  })

  it('ignores actions that do not belong to the current step', () => {
    expect(feedbackFlowReducer(FEEDBACK_IDLE, { type: 'open-markup' })).toBe(FEEDBACK_IDLE)
    expect(feedbackFlowReducer(FEEDBACK_IDLE, { type: 'captured', capture: CAPTURE })).toBe(
      FEEDBACK_IDLE
    )
    const markup = run([
      { type: 'capture-started' },
      { type: 'captured', capture: CAPTURE },
      { type: 'open-markup' }
    ])
    // A second Screenshot tap while drawing must not throw the drawing away.
    expect(feedbackFlowReducer(markup, { type: 'capture-started' })).toBe(markup)
    expect(run([{ type: 'capture-started' }, { type: 'capture-failed' }])).toBe(FEEDBACK_IDLE)
    expect(feedbackFlowReducer(markup, { type: 'dismiss' })).toBe(FEEDBACK_IDLE)
  })
})

describe('feedback list', () => {
  const item = (id: string, patch: Partial<FeedbackItem> = {}): FeedbackItem => ({
    id,
    createdAt: 1,
    updatedAt: 1,
    thumbnailUri: 't',
    pageLabel: '/p',
    intent: 'change',
    commentPreview: 'c',
    status: 'sending',
    targetLabel: null,
    hostImagePath: null,
    error: null,
    ...patch
  })

  it('keeps newest first, replaces by id, updates status and notifies', () => {
    const list = createFeedbackList(2)
    const listener = vi.fn()
    const unsubscribe = list.subscribe(listener)
    list.upsert(item('a'))
    list.upsert(item('b'))
    list.update('a', { status: 'delivered', targetLabel: 'zsh (term-1)' })
    expect(list.getSnapshot().map((entry) => [entry.id, entry.status])).toEqual([
      ['b', 'sending'],
      ['a', 'delivered']
    ])
    list.upsert(item('c'))
    expect(list.getSnapshot().map((entry) => entry.id)).toEqual(['c', 'b'])
    expect(list.referencedIds()).toEqual(new Set(['c', 'b']))
    list.update('missing', { status: 'failed' })
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    list.clear()
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('labels statuses and previews comments on one line', () => {
    expect(feedbackStatusLabel({ status: 'delivered', targetLabel: 'zsh (term-1)' })).toBe(
      'Delivered to zsh (term-1)'
    )
    expect(feedbackStatusLabel({ status: 'failed', targetLabel: null })).toBe('Not delivered')
    expect(feedbackCommentPreview('a\n b   c')).toBe('a b c')
    expect(feedbackCommentPreview('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`)
  })
})
