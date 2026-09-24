import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { MessageSquarePlus, PenLine, Trash2 } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing } from '../theme/mobile-theme'
import { feedbackCaptureHintGate } from './feedback-capture-hint'
import { feedbackFlowHoldsViewport, type FeedbackFlowState } from './feedback-flow'
import type { FeedbackHeader } from './feedback-message'
import { feedbackCaptureSupported, readFeedbackDeviceInfo } from './feedback-platform'
import { FEEDBACK_CHIP_GAP, FEEDBACK_CHIP_HEIGHT } from './feedback-touch-targets'
import type { MarkupState } from './markup-model'
import type { MobileFeedbackHostProps, MobileFeedbackKit } from './mobile-feedback-kit'
import { MobileFeedbackCaptureHint } from './MobileFeedbackCaptureHint'
import { MobileFeedbackComposer } from './MobileFeedbackComposer'
import { MobileFeedbackDelivered } from './MobileFeedbackDelivered'
import { MobileFeedbackScreenshotButton } from './MobileFeedbackScreenshotButton'
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
  const [hintAt, setHintAt] = useState<number | null>(
    demoView?.captureHint ? captureRequest : null
  )
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
      {state.kind === 'capturing' ? (
        <View style={[styles.chip, styles.chipBusy]}>
          <ActivityIndicator size="small" color={colors.textPrimary} />
        </View>
      ) : null}
      {state.kind === 'captured' ? (
        <View style={styles.chip}>
          <Pressable
            style={styles.thumbButton}
            onPress={() => dispatch({ type: 'open-markup' })}
            accessibilityRole="button"
            accessibilityLabel="Mark up screenshot"
          >
            <Image
              source={{ uri: state.capture.thumbnailUri }}
              style={[styles.thumb, { aspectRatio: state.capture.width / state.capture.height }]}
            />
          </Pressable>
          <View style={styles.chipActions}>
            <ChipButton label="Mark up" onPress={() => dispatch({ type: 'open-markup' })}>
              <PenLine size={14} color={colors.bgBase} strokeWidth={2.4} />
            </ChipButton>
            {/* Opens the composer; nothing is sent until its "Send to agent". */}
            <ChipButton label="Add feedback" onPress={() => dispatch({ type: 'skip-markup' })}>
              <MessageSquarePlus size={14} color={colors.bgBase} strokeWidth={2.4} />
            </ChipButton>
            <ChipButton label="Discard screenshot" onPress={close} subtle>
              <Trash2 size={14} color={colors.textPrimary} strokeWidth={2.2} />
            </ChipButton>
          </View>
        </View>
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

function ChipButton(props: {
  label: string
  onPress: () => void
  subtle?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.chipButton,
        props.subtle && styles.chipButtonSubtle,
        pressed && styles.pressed
      ]}
    >
      {props.children}
      <Text style={[styles.chipButtonText, props.subtle && styles.chipButtonTextSubtle]}>
        {props.label}
      </Text>
    </Pressable>
  )
}

/** Handed to the browser pane and the HTML preview by the session screen. */
export const MOBILE_FEEDBACK_KIT: MobileFeedbackKit = {
  supported: feedbackCaptureSupported,
  Host: MobileFeedbackHost,
  ScreenshotButton: MobileFeedbackScreenshotButton
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    zIndex: 35,
    padding: 6,
    gap: 6,
    borderRadius: radii.card,
    backgroundColor: 'rgba(26,26,26,0.94)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  chipBusy: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  thumbButton: { alignSelf: 'center' },
  thumb: { width: 96, borderRadius: 8, backgroundColor: colors.bgRaised },
  chipActions: { gap: FEEDBACK_CHIP_GAP },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: FEEDBACK_CHIP_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: FEEDBACK_CHIP_HEIGHT / 2,
    backgroundColor: colors.textPrimary
  },
  chipButtonSubtle: { backgroundColor: colors.bgRaised },
  chipButtonText: { color: colors.bgBase, fontSize: 13, fontWeight: '700' },
  chipButtonTextSubtle: { color: colors.textPrimary },
  pressed: { opacity: 0.75 }
})
