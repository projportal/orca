import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { View } from 'react-native'
import type {
  MobileFeedbackBinding,
  MobileFeedbackPageContext
} from '../feedback/mobile-feedback-kit'

export type HtmlPreviewFeedback = MobileFeedbackBinding & { pageLabel: string }

const noop = () => {}

/**
 * The HTML preview's side of the feedback flow: a Screenshot button, and the flow's layer over the
 * WebView, which is also the view the screenshot snapshots. Nothing renders without a kit.
 */
export function useHtmlPreviewFeedback(feedback: HtmlPreviewFeedback | undefined): {
  viewRef: { current: View | null }
  onLayout: (size: { width: number; height: number }) => void
  toolbarButton: ReactNode
  layer: ReactNode
} {
  const viewRef = useRef<View | null>(null)
  const sizeRef = useRef<{ width: number; height: number } | null>(null)
  const [captureRequest, setCaptureRequest] = useState(0)
  const labelRef = useRef(feedback?.pageLabel ?? '')
  labelRef.current = feedback?.pageLabel ?? ''
  const onLayout = useCallback((size: { width: number; height: number }) => {
    sizeRef.current = { width: Math.round(size.width), height: Math.round(size.height) }
  }, [])
  const getPageContext = useCallback(
    (): MobileFeedbackPageContext => ({
      pageUrl: labelRef.current,
      browserTabId: null,
      viewport: sizeRef.current,
      viewMode: 'html-preview'
    }),
    []
  )
  if (!feedback?.kit.supported) {
    return { viewRef, onLayout, toolbarButton: null, layer: null }
  }
  const { Host, ScreenshotButton } = feedback.kit
  return {
    viewRef,
    onLayout,
    toolbarButton: (
      <ScreenshotButton disabled={false} onPress={() => setCaptureRequest((value) => value + 1)} />
    ),
    layer: (
      <Host
        client={feedback.client}
        worktreeId={feedback.worktreeId}
        getConnectionId={feedback.getConnectionId}
        captureRequest={captureRequest}
        source={{ kind: 'view', viewRef }}
        getPageContext={getPageContext}
        // The overlay covers the WebView, so no touch reaches the page while drawing.
        onViewportHeldChange={noop}
        onToast={feedback.onToast}
      />
    )
  }
}
