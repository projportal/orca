import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { feedbackCaptureHintGate } from './feedback-capture-hint'
import { feedbackFlowHoldsViewport, type FeedbackFlowState } from './feedback-flow'
import type { FeedbackHeader } from './feedback-message'
import { feedbackCaptureSupported, readFeedbackDeviceInfo } from './feedback-platform'
import type { MarkupState } from './markup-model'
import type { MobileFeedbackHostProps, MobileFeedbackKit } from './mobile-feedback-kit'
import { MobileFeedbackCaptureHint } from './MobileFeedbackCaptureHint'
import { MobileFeedbackComposer } from './MobileFeedbackComposer'
import { MobileFeedbackDelivered } from './MobileFeedbackDelivered'
import { MobileFeedbackScreenshotButton } from './MobileFeedbackScreenshotButton'
import {
  MobileFeedbackCapturingChip,
  MobileFeedbackThumbnailChip
} from './MobileFeedbackThumbnailChip'
import { MobileMarkupOverlay } from './MobileMarkupOverlay'
import {
  useMobileFeedbackFlow,
  useMobileFeedbackList,
  type MobileFeedbackFlow
} from './use-mobile-feedback-flow'

/** Demo route only: states to open on first paint, so each can be screenshotted untouched. */
export type MobileFeedbackDemoView = {
  captureHint?: boolean
  detailsOpen?: boolean
  viewerOpen?: boolean
}

type HostProps = MobileFeedbackHostProps & {
  /** Demo route only: a drawing to open markup with, and a handle on the flow to script it. */
  markupSeed?: MarkupState
  markupAutoFinishMs?: number
  onFlow?: (flow: MobileFeedbackFlow) => void
  sleep?: (ms: number) => Promise<void>
  demoView?: MobileFeedbackDemoView
}

/** The camera button is the toolbar's last item: toolbar padding plus half the 26 pt button. */
const CAMERA_CENTER_FROM_RIGHT = { 'browser-frame': 21, view: 25 } as const

/**
 * The whole feedback flow for one pane, drawn over its viewport: the screenshot thumbnail, the
 * markup overlay, and the composer sheet. Rendered inside the viewport so the overlay covers
 * exactly the frame; the sheet is its own native window.
 */
export function MobileFeedbackHost(props: HostProps) {
  const { captureRequest, source, onViewportHeldChange, onFlow, demoView } = props
  const flow = useMobileFeedbackFlow({
    client: props.client,
    worktreeId: props.worktreeId,
    getConnectionId: props.getConnectionId,
    getPageContext: props.getPageContext,
    onToast: props.onToast,
    sleep: props.sleep
  })
  const { state, dispatch } = flow
  const items = useMobileFeedbackList()
  const handledRequest = useRef(captureRequest)
  // The capture request the hint was shown at: the next camera tap moves past it and hides it.
  const [hintAt, setHintAt] = useState<number | null>(demoView?.captureHint ? captureRequest : null)
  const hintShown = hintAt === captureRequest
  const dismissHint = useCallback(() => setHintAt(null), [])

  useEffect(() => {
    if (demoView?.captureHint) {
      return
    }
    let live = true
    void feedbackCaptureHintGate.claim().then((show) => {
      if (live && show) {
        setHintAt(handledRequest.current)
      }
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (captureRequest === handledRequest.current) {
      return
    }
    handledRequest.current = captureRequest
    if (source.kind === 'browser-frame') {
      flow.captureFrame(source.getFrameUri())
    } else {
      flow.captureView(source.viewRef)
    }
  }, [captureRequest])

  const held = feedbackFlowHoldsViewport(state)
  useEffect(() => {
    onViewportHeldChange(held)
  }, [held, onViewportHeldChange])
  useEffect(
    () => () => {
      onViewportHeldChange(false)
    },
    [onViewportHeldChange]
  )

  useEffect(() => {
    onFlow?.(flow)
  }, [flow, onFlow])

  // Why: the sheet animates out after `dismiss`; keep painting what it last showed meanwhile.
  const sheetStateRef = useRef<FeedbackFlowState | null>(null)
  if (state.kind === 'composing' || state.kind === 'delivered') {
    sheetStateRef.current = state
  }
  const sheetState = sheetStateRef.current
  const sheetOpen = state.kind === 'composing' || state.kind === 'delivered'
  const header: FeedbackHeader = useMemo(
    () => ({ ...props.getPageContext(), ...readFeedbackDeviceInfo() }),
    [sheetOpen, state.kind]
  )
  const close = () => dispatch({ type: 'dismiss' })

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {hintShown && state.kind === 'idle' ? (
        <MobileFeedbackCaptureHint
          buttonCenterFromRight={CAMERA_CENTER_FROM_RIGHT[source.kind]}
          onDismiss={dismissHint}
        />
      ) : null}
      {state.kind === 'capturing' ? <MobileFeedbackCapturingChip /> : null}
      {state.kind === 'captured' ? (
        <MobileFeedbackThumbnailChip
          capture={state.capture}
          onMarkUp={() => dispatch({ type: 'open-markup' })}
          onAddFeedback={() => dispatch({ type: 'skip-markup' })}
          onDiscard={close}
        />
      ) : null}
      {state.kind === 'markup' ? (
        <MobileMarkupOverlay
          capture={state.capture}
          initialState={state.seed ?? props.markupSeed}
          autoFinishMs={props.markupAutoFinishMs}
          onCancel={() => dispatch({ type: 'cancel-markup' })}
          onDone={(image, markup) => dispatch({ type: 'markup-done', image, markup })}
          onError={(message) => props.onToast(message, 2000)}
        />
      ) : null}
      <BottomDrawer visible={sheetOpen} onClose={close} fillAvailable={false}>
        {sheetState?.kind === 'composing' ? (
          <MobileFeedbackComposer
            composer={sheetState.composer}
            flow={flow}
            header={header}
            onClose={close}
            initialDetailsOpen={demoView?.detailsOpen}
            initialViewerOpen={demoView?.viewerOpen}
          />
        ) : sheetState?.kind === 'delivered' ? (
          <MobileFeedbackDelivered
            item={items.find((item) => item.id === sheetState.itemId) ?? null}
            items={items}
            onDone={close}
            initialDetailsOpen={demoView?.detailsOpen}
          />
        ) : null}
      </BottomDrawer>
    </View>
  )
}

/** Handed to the browser pane and the HTML preview by the session screen. */
export const MOBILE_FEEDBACK_KIT: MobileFeedbackKit = {
  supported: feedbackCaptureSupported,
  Host: MobileFeedbackHost,
  ScreenshotButton: MobileFeedbackScreenshotButton
}
