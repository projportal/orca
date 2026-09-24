import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { feedbackComposerStyles as styles } from './feedback-composer-styles'

/**
 * "Details": the technical rows (image size, header fields, host path), closed unless asked for,
 * so the sheet leads with what the user decides.
 */
export function MobileFeedbackDetails({
  rows,
  initiallyOpen = false
}: {
  rows: readonly (readonly [string, string])[]
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <View style={styles.details}>
      <Pressable
        style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel="Details"
        accessibilityState={{ expanded: open }}
      >
        <Chevron size={15} color={colors.textSecondary} />
        <Text style={styles.detailsTitle}>Details</Text>
      </Pressable>
      {open
        ? rows.map(([name, value]) => (
            <View key={name} style={styles.detailRow}>
              <Text style={styles.detailName}>{name}</Text>
              <Text style={styles.detailValue} numberOfLines={2} selectable>
                {value}
              </Text>
            </View>
          ))
        : null}
    </View>
  )
}
