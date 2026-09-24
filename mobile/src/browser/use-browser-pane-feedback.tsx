import { useCallback, useRef, useState, type ReactNode } from 'react'
import type {
  MobileFeedbackBinding,
  MobileFeedbackPageContext
} from '../feedback/mobile-feedback-kit'
import type { BrowserScreencastFrameMetadata } from '../transport/browser-screencast-protocol'
import type { MobileBrowserViewMode } from './browser-screencast-request'
import { peekCachedBrowserFrame } from './mobile-browser-frame-state'
import type { MobileBrowserTab } from './MobileBrowserPane'

type Args = {
  feedback: MobileFeedbackBinding | undefined
  cacheKey: string | null
  tab: MobileBrowserTab
  browserViewMode: MobileBrowserViewMode
  frameMetadata: BrowserScreencastFrameMetadata | null
  hasFrame: boolean
  /** Drops any gesture in flight when markup takes the viewport. */
  resetGestures: () => void
}

/**
 * The pane's side of the feedback flow: a Screenshot button for the toolbar, the flow's layer for
 * the viewport, and the ref the touch handlers read to stop forwarding while markup is armed.
 * Renders nothing without a kit (the page bundle, the pane's own tests).
 */
export function useBrowserPaneFeedback(args: Args): {
  markupArmedRef: { current: boolean }
  toolbarButton: ReactNode
  viewportLayer: ReactNode
} {
  const { feedback, cacheKey, tab, browserViewMode, frameMetadata, hasFrame, resetGestures } = args
  const [captureRequest, setCaptureRequest] = useState(0)
  const markupArmedRef = useRef(false)
  const latest = useRef({ cacheKey, tab, browserViewMode, frameMetadata })
  latest.current = { cacheKey, tab, browserViewMode, frameMetadata }

  const onViewportHeldChange = useCallback(
    (held: boolean) => {
      markupArmedRef.current = held
      if (held) {
        resetGestures()
      }
    },
    [resetGestures]
  )
  // The frame on screen is the one the pacer last cached for this stream: its bytes are the
  // screenshot, so nothing is requested from the desktop.
  const getFrameUri = useCallback(
    () => peekCachedBrowserFrame(latest.current.cacheKey)?.uri ?? null,
    []
  )
  const getPageContext = useCallback((): MobileFeedbackPageContext => {
    const { tab: current, browserViewMode: mode, frameMetadata: metadata } = latest.current
    return {
      pageUrl: current.url,
      browserTabId: current.browserPageId,
      viewport:
        metadata?.deviceWidth && metadata.deviceHeight
          ? { width: Math.round(metadata.deviceWidth), height: Math.round(metadata.deviceHeight) }
          : null,
      viewMode: mode
    }
  }, [])

  if (!feedback?.kit.supported) {
    return { markupArmedRef, toolbarButton: null, viewportLayer: null }
  }
  const { Host, ScreenshotButton } = feedback.kit
  return {
    markupArmedRef,
    toolbarButton: (
      <ScreenshotButton
        disabled={!hasFrame}
        onPress={() => setCaptureRequest((value) => value + 1)}
      />
    ),
    viewportLayer: (
      <Host
        client={feedback.client}
        worktreeId={feedback.worktreeId}
        getConnectionId={feedback.getConnectionId}
        captureRequest={captureRequest}
        source={{ kind: 'browser-frame', getFrameUri }}
        getPageContext={getPageContext}
        onViewportHeldChange={onViewportHeldChange}
        onToast={feedback.onToast}
      />
    )
  }
}
