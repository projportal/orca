import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Camera } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { FEEDBACK_CAPTURE_HINT_MS, FEEDBACK_CAPTURE_HINT_TEXT } from './feedback-capture-hint'

const CARET = 7
const EDGE = spacing.sm

/**
 * A small tooltip under the toolbar's camera button (the last item on the right), pointing up at
 * it. Tap or {@link FEEDBACK_CAPTURE_HINT_MS} dismisses it.
 */
export function MobileFeedbackCaptureHint({
  buttonCenterFromRight,
  onDismiss
}: {
  /** Distance from the pane's right edge to the camera button's centre, in points. */
  buttonCenterFromRight: number
  onDismiss: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, FEEDBACK_CAPTURE_HINT_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])
  return (
    <Pressable
      style={styles.root}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={FEEDBACK_CAPTURE_HINT_TEXT}
      accessibilityHint="Dismisses this tip"
    >
      <View style={[styles.caret, { right: buttonCenterFromRight - EDGE - CARET }]} />
      <View style={styles.bubble}>
        <Camera size={14} color={colors.bgBase} strokeWidth={2.4} />
        <Text style={styles.text}>{FEEDBACK_CAPTURE_HINT_TEXT}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 4, right: EDGE, zIndex: 45, alignItems: 'flex-end' },
  caret: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: CARET,
    borderRightWidth: CARET,
    borderBottomWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textPrimary
  },
  bubble: {
    marginTop: CARET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }
  },
  text: { color: colors.bgBase, fontSize: 13, fontWeight: '700' }
})
