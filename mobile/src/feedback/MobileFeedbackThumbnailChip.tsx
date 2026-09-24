import type { ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { MessageSquarePlus, PenLine, Trash2 } from 'lucide-react-native'
import { colors, radii, spacing } from '../theme/mobile-theme'
import type { FeedbackCapture } from './feedback-capture'
import {
  FEEDBACK_CHIP_GAP,
  FEEDBACK_CHIP_HEIGHT,
  FEEDBACK_MIN_TOUCH
} from './feedback-touch-targets'

/** Shown in the thumbnail's place while the screenshot is being taken. */
export function MobileFeedbackCapturingChip() {
  return (
    <View style={[styles.chip, styles.chipBusy]}>
      <ActivityIndicator size="small" color={colors.textPrimary} />
    </View>
  )
}

/** The fresh screenshot and its three next steps, over the pane's bottom-left corner. */
export function MobileFeedbackThumbnailChip(props: {
  capture: FeedbackCapture
  onMarkUp: () => void
  onAddFeedback: () => void
  onDiscard: () => void
}) {
  const { capture } = props
  return (
    <View style={styles.chip}>
      <Pressable
        style={styles.thumbButton}
        onPress={props.onMarkUp}
        accessibilityRole="button"
        accessibilityLabel="Mark up screenshot"
      >
        <Image
          source={{ uri: capture.thumbnailUri }}
          style={[styles.thumb, { aspectRatio: capture.width / capture.height }]}
        />
      </Pressable>
      <View style={styles.chipActions}>
        <ChipButton label="Mark up" onPress={props.onMarkUp}>
          <PenLine size={14} color={colors.bgBase} strokeWidth={2.4} />
        </ChipButton>
        {/* Opens the composer; nothing is sent until its "Send to agent". */}
        <ChipButton label="Add feedback" onPress={props.onAddFeedback}>
          <MessageSquarePlus size={14} color={colors.bgBase} strokeWidth={2.4} />
        </ChipButton>
        <ChipButton label="Discard screenshot" onPress={props.onDiscard} subtle>
          <Trash2 size={14} color={colors.textPrimary} strokeWidth={2.2} />
        </ChipButton>
      </View>
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
  thumbButton: {
    alignSelf: 'center',
    minWidth: FEEDBACK_MIN_TOUCH,
    minHeight: FEEDBACK_MIN_TOUCH
  },
  thumb: { width: 96, borderRadius: 8, backgroundColor: colors.bgRaised },
  chipActions: { gap: FEEDBACK_CHIP_GAP },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: FEEDBACK_MIN_TOUCH,
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
