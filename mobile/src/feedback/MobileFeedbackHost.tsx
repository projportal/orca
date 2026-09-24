import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { PenLine, Send, X } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing } from '../theme/mobile-theme'
import { feedbackFlowHoldsViewport, type FeedbackFlowState } from './feedback-flow'
import type { FeedbackHeader } from './feedback-message'
import { feedbackCaptureSupported, readFeedbackDeviceInfo } from './feedback-platform'
import type { MarkupState } from './markup-model'
import type { MobileFeedbackHostProps, MobileFeedbackKit } from './mobile-feedback-kit'
import { MobileFeedbackComposer } from './MobileFeedbackComposer'
import { MobileFeedbackDelivered } from './MobileFeedbackDelivered'
import { MobileFeedbackScreenshotButton } from './MobileFeedbackScreenshotButton'
import { MobileMarkupOverlay } from './MobileMarkupOverlay'
import {
  useMobileFeedbackFlow,
  useMobileFeedbackList,
  type MobileFeedbackFlow
} from './use-mobile-feedback-flow'

type HostProps = MobileFeedbackHostProps & {
  /** Demo route only: a drawing to open markup with, and a handle on the flow to script it. */
  markupSeed?: MarkupState
  markupAutoFinishMs?: number
  onFlow?: (flow: MobileFeedbackFlow) => void
  sleep?: (ms: number) => Promise<void>
}

/**
 * The whole feedback flow for one pane, drawn over its viewport: the screenshot thumbnail, the
 * markup overlay, and the composer sheet. Rendered inside the viewport so the overlay covers
 * exactly the frame; the sheet is its own native window.
 */
export function MobileFeedbackHost(props: HostProps) {
  const { captureRequest, source, onViewportHeldChange, onFlow } = props
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
      {state.kind === 'capturing' ? (
        <View style={[styles.chip, styles.chipBusy]}>
          <ActivityIndicator size="small" color={colors.textPrimary} />
        </View>
      ) : null}
      {state.kind === 'captured' ? (
        <View style={styles.chip}>
          <Pressable
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
            <ChipButton label="Send" onPress={() => dispatch({ type: 'skip-markup' })}>
              <Send size={13} color={colors.bgBase} strokeWidth={2.4} />
            </ChipButton>
            <ChipButton label="Discard screenshot" onPress={close} subtle>
              <X size={14} color={colors.textPrimary} strokeWidth={2.4} />
            </ChipButton>
          </View>
        </View>
      ) : null}
      {state.kind === 'markup' ? (
        <MobileMarkupOverlay
          capture={state.capture}
          initialState={props.markupSeed}
          autoFinishMs={props.markupAutoFinishMs}
          onCancel={() => dispatch({ type: 'cancel-markup' })}
          onDone={(image) => dispatch({ type: 'markup-done', image })}
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
          />
        ) : sheetState?.kind === 'delivered' ? (
          <MobileFeedbackDelivered
            item={items.find((item) => item.id === sheetState.itemId) ?? null}
            items={items}
            onDone={close}
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
      hitSlop={4}
      style={({ pressed }) => [
        styles.chipButton,
        props.subtle && styles.chipButtonSubtle,
        pressed && styles.pressed
      ]}
    >
      {props.children}
      {props.subtle ? null : <Text style={styles.chipButtonText}>{props.label}</Text>}
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
  thumb: { width: 96, borderRadius: 8, backgroundColor: colors.bgRaised },
  chipActions: { gap: 4 },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.textPrimary
  },
  chipButtonSubtle: { backgroundColor: colors.bgRaised },
  chipButtonText: { color: colors.bgBase, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.75 }
})
