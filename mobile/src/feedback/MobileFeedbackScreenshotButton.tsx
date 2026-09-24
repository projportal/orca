import { Pressable, StyleSheet } from 'react-native'
import { Camera } from 'lucide-react-native'
import { colors, radii } from '../theme/mobile-theme'
import { FEEDBACK_CAPTURE_HINT_TEXT } from './feedback-capture-hint'
import type { MobileFeedbackScreenshotButtonProps } from './mobile-feedback-kit'

/** The toolbar's Screenshot action: freezes what is on screen for feedback. */
export function MobileFeedbackScreenshotButton({
  disabled,
  onPress
}: MobileFeedbackScreenshotButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={FEEDBACK_CAPTURE_HINT_TEXT}
      hitSlop={6}
    >
      <Camera size={15} color={disabled ? colors.textMuted : colors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 26,
    height: 26,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: { backgroundColor: colors.bgRaised },
  disabled: { opacity: 0.35 }
})
