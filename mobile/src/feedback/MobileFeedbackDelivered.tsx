import { Image, Pressable, Text, View } from 'react-native'
import { CircleCheck } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { feedbackComposerStyles as styles } from './feedback-composer-styles'
import { feedbackStatusLabel, type FeedbackItem, type FeedbackItemStatus } from './feedback-list'
import { MobileFeedbackDetails } from './MobileFeedbackDetails'

const CHIP: Record<FeedbackItemStatus, { background: string; text: string; label: string }> = {
  sending: { background: colors.bgRaised, text: colors.textSecondary, label: 'Sending' },
  delivered: { background: 'rgba(34,197,94,0.16)', text: colors.statusGreen, label: 'Delivered' },
  copied: { background: 'rgba(59,130,246,0.16)', text: colors.accentBlue, label: 'Copied' },
  failed: { background: 'rgba(239,68,68,0.16)', text: colors.statusRed, label: 'Not delivered' }
}

/** After a send: what happened to this one, and the phone's local feedback list. */
export function MobileFeedbackDelivered({
  item,
  items,
  onDone,
  initialDetailsOpen
}: {
  item: FeedbackItem | null
  items: readonly FeedbackItem[]
  onDone: () => void
  /** Demo route only. */
  initialDetailsOpen?: boolean
}) {
  return (
    <View>
      <View style={styles.deliveredHead}>
        <CircleCheck size={34} color={colors.statusGreen} strokeWidth={2.2} />
        <Text style={styles.deliveredTitle}>
          {item?.status === 'copied' ? 'Feedback copied' : 'Feedback delivered'}
        </Text>
        {item ? <Text style={styles.deliveredTarget}>{feedbackStatusLabel(item)}</Text> : null}
      </View>
      {item?.hostImagePath ? (
        <MobileFeedbackDetails
          rows={[['Image on host', item.hostImagePath]]}
          initiallyOpen={initialDetailsOpen}
        />
      ) : null}
      <Text style={styles.listTitle}>Feedback on this phone</Text>
      {items.map((entry) => {
        const chip = CHIP[entry.status]
        return (
          <View key={entry.id} style={styles.listRow}>
            <Image source={{ uri: entry.thumbnailUri }} style={styles.listThumb} />
            <View style={styles.listText}>
              <Text style={styles.listPage} numberOfLines={1}>
                {entry.pageLabel}
              </Text>
              <Text style={styles.listComment} numberOfLines={1}>
                {`${entry.intent === 'question' ? 'Question' : 'Change'} · ${entry.commentPreview || 'no comment'}`}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: chip.background }]}>
              <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
            </View>
          </View>
        )
      })}
      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={onDone}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  )
}
