/**
 * While feedback markup is open the page's key strip (modifiers, keys, "Type on page…") steps
 * aside so the canvas gets that room, and it comes back when markup closes. The flow's state
 * decides it: the host reports `feedbackFlowHoldsViewport` as the held signal.
 */
import { createElement, Fragment } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import type { FeedbackCapture } from '../feedback/feedback-capture'
import {
  FEEDBACK_IDLE,
  feedbackFlowHoldsViewport,
  feedbackFlowReducer,
  type FeedbackFlowAction
} from '../feedback/feedback-flow'
import type {
  MobileFeedbackBinding,
  MobileFeedbackHostProps,
  MobileFeedbackKit
} from '../feedback/mobile-feedback-kit'
import type { MobileBrowserTab } from './MobileBrowserPane'
import { useBrowserPaneFeedback } from './use-browser-pane-feedback'

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

const TAB: MobileBrowserTab = {
  type: 'browser',
  id: 'tab-1',
  title: 'Pricing',
  browserWorkspaceId: 'ws-1',
  browserPageId: 'page-1',
  url: 'http://localhost:5173/pricing',
  loading: false,
  canGoBack: false,
  canGoForward: false,
  isActive: true
}

type Probe = {
  held: ((held: boolean) => void) | null
  pageKeysHidden: boolean | null
  armed: { current: boolean } | null
  resets: number
}

let renderer: ReactTestRenderer | null = null

afterEach(() => {
  act(() => renderer?.unmount())
  renderer = null
})

function mountPane(): Probe {
  const probe: Probe = { held: null, pageKeysHidden: null, armed: null, resets: 0 }
  function Host(props: MobileFeedbackHostProps): null {
    probe.held = props.onViewportHeldChange
    return null
  }
  const kit: MobileFeedbackKit = { supported: true, Host, ScreenshotButton: () => null }
  const feedback: MobileFeedbackBinding = {
    kit,
    client: null,
    worktreeId: 'wt-1',
    getConnectionId: async () => null,
    onToast: () => {}
  }
  function Pane() {
    const result = useBrowserPaneFeedback({
      feedback,
      cacheKey: null,
      tab: TAB,
      browserViewMode: 'mobile',
      frameMetadata: null,
      hasFrame: true,
      resetGestures: () => {
        probe.resets += 1
      }
    })
    probe.pageKeysHidden = result.pageKeysHidden
    probe.armed = result.markupArmedRef
    return createElement(Fragment, null, result.viewportLayer)
  }
  act(() => {
    renderer = create(createElement(Pane))
  })
  return probe
}

describe('page key strip during markup', () => {
  it('hides while the flow is in markup and returns on Cancel, Done and dismiss', () => {
    const probe = mountPane()
    expect(probe.pageKeysHidden).toBe(false)
    const image = { uri: 'file:///c/flat.png', width: 1206, height: 2148, markedUp: true }
    const steps: FeedbackFlowAction[] = [
      { type: 'capture-started' },
      { type: 'captured', capture: CAPTURE },
      { type: 'open-markup' },
      { type: 'cancel-markup' },
      { type: 'open-markup' },
      { type: 'markup-done', image, markup: null },
      { type: 'edit-markup' },
      { type: 'dismiss' }
    ]
    let state = FEEDBACK_IDLE
    const seen: boolean[] = []
    for (const action of steps) {
      state = feedbackFlowReducer(state, action)
      const held = feedbackFlowHoldsViewport(state)
      act(() => probe.held?.(held))
      expect(probe.pageKeysHidden, `${action.type} -> ${state.kind}`).toBe(held)
      expect(probe.armed?.current).toBe(held)
      seen.push(probe.pageKeysHidden === true)
    }
    expect(seen).toEqual([false, false, true, false, true, false, true, false])
    expect(probe.resets).toBe(3)
  })

  it('never hides the strip without a feedback kit', () => {
    let hidden: boolean | null = null
    function Pane(): null {
      hidden = useBrowserPaneFeedback({
        feedback: undefined,
        cacheKey: null,
        tab: TAB,
        browserViewMode: 'mobile',
        frameMetadata: null,
        hasFrame: true,
        resetGestures: () => {}
      }).pageKeysHidden
      return null
    }
    act(() => {
      renderer = create(createElement(Pane))
    })
    expect(hidden).toBe(false)
  })
})
