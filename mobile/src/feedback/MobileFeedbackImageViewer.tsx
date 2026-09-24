import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { PenLine } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme/mobile-theme'
import type { FeedbackComposedImage } from './feedback-flow'
import { FEEDBACK_MIN_TOUCH } from './feedback-touch-targets'

type Props = {
  visible: boolean
  image: FeedbackComposedImage
  onClose: () => void
  /** Absent while sending: the drawing cannot change under an upload. */
  onEditMarkup?: () => void
}

/** The attachment at readable size: exactly the file the composer will send. */
export function MobileFeedbackImageViewer({ visible, image, onClose, onEditMarkup }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          {onEditMarkup ? (
            <Pressable
              style={({ pressed }) => [styles.button, styles.edit, pressed && styles.pressed]}
              onPress={onEditMarkup}
              accessibilityRole="button"
              accessibilityLabel="Edit markup"
            >
              <PenLine size={15} color={colors.bgBase} strokeWidth={2.4} />
              <Text style={styles.editText}>Edit markup</Text>
            </Pressable>
          ) : null}
        </View>
        <Image
          source={{ uri: image.uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Screenshot to send"
        />
        <Text style={styles.meta}>
          {`${image.width}x${image.height} px${image.markedUp ? ' · marked up' : ''}`}
        </Text>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  button: {
    minHeight: FEEDBACK_MIN_TOUCH,
    minWidth: FEEDBACK_MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: FEEDBACK_MIN_TOUCH / 2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  edit: { backgroundColor: colors.textPrimary },
  pressed: { opacity: 0.75 },
  closeText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  editText: { color: colors.bgBase, fontSize: 15, fontWeight: '700' },
  image: { flex: 1, margin: spacing.md },
  meta: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingBottom: spacing.sm }
})
