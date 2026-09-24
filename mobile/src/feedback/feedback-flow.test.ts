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
import { feedbackComposerDetailRows } from './feedback-message'
import { createMarkupState, markupReducer } from './markup-model'
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
        { type: 'markup-done', image, markup: null },
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

  it('reopens markup from the composer with the drawing, keeping the comment', () => {
    const drawing = markupReducer(createMarkupState(), { type: 'set-color', color: '#34c759' })
    const first = { uri: 'file:///c/crop-1.png', width: 1110, height: 860, markedUp: true }
    let state = run([
      { type: 'capture-started' },
      { type: 'captured', capture: CAPTURE },
      { type: 'open-markup' },
      { type: 'markup-done', image: first, markup: drawing },
      { type: 'set-comment', comment: 'move the CTA' },
      { type: 'set-intent', intent: 'question' },
      { type: 'edit-markup' }
    ])
    expect(state).toMatchObject({ kind: 'markup', seed: drawing })
    expect(feedbackFlowHoldsViewport(state)).toBe(true)

    // Cancel drops only this round: the composer comes back as it was.
    const cancelled = feedbackFlowReducer(state, { type: 'cancel-markup' })
    expect(cancelled).toMatchObject({
      kind: 'composing',
      composer: { image: first, comment: 'move the CTA', intent: 'question' }
    })

    const second = { uri: 'file:///c/crop-2.png', width: 900, height: 700, markedUp: true }
    state = run(
      [{ type: 'edit-markup' }, { type: 'markup-done', image: second, markup: drawing }],
      cancelled
    )
    expect(state).toMatchObject({
      kind: 'composing',
      composer: { image: second, markup: drawing, comment: 'move the CTA', intent: 'question' }
    })
  })

  it('does not reopen markup while a send is in flight', () => {
    const composing = run([
      { type: 'capture-started' },
      { type: 'captured', capture: CAPTURE },
      { type: 'skip-markup' },
      { type: 'send-started' }
    ])
    expect(feedbackFlowReducer(composing, { type: 'edit-markup' })).toBe(composing)
  })

  it('lists the image first under Details, then the header fields', () => {
    const rows = feedbackComposerDetailRows(
      { width: 1110, height: 860, markedUp: true },
      {
        pageUrl: 'http://localhost:5173/pricing',
        browserTabId: 'page-7',
        viewport: { width: 402, height: 560 },
        viewMode: 'mobile',
        deviceModel: 'iPhone 17 Pro',
        os: 'iOS 26.3',
        appVersion: 'Orca Review 0.1.0 (1)'
      }
    )
    expect(rows[0]).toEqual(['Image', '1110x860 px · marked up'])
    expect(rows.map(([name]) => name)).toContain('URL')
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
