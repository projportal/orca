import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from 'react-native'
import { CircleQuestionMark, Send, Wrench, X } from 'lucide-react-native'
import { ActionSheetContent } from '../components/ActionSheetModal'
import { buildAgentTargetActions } from '../components/agent-target-actions'
import { useKeyboardAvoidingPadding } from '../platform/keyboard-occlusion'
import { colors } from '../theme/mobile-theme'
import type { FeedbackComposer } from './feedback-flow'
import {
  FEEDBACK_COMMENT_MAX_CHARS,
  feedbackHeaderRows,
  feedbackPageHeading,
  type FeedbackHeader,
  type FeedbackIntent
} from './feedback-message'
import { feedbackComposerStyles as styles } from './feedback-composer-styles'
import type { MobileFeedbackFlow } from './use-mobile-feedback-flow'

type Props = {
  composer: FeedbackComposer
  flow: MobileFeedbackFlow
  header: FeedbackHeader
  onClose: () => void
}

const INTENTS: { intent: FeedbackIntent; label: string }[] = [
  { intent: 'change', label: 'Change' },
  { intent: 'question', label: 'Question' }
]

/**
 * The feedback sheet: comment, intent, the auto header, and "Send to agent". The target picker is
 * the review-notes sheet's rows, shown in place so only one native sheet is ever up.
 */
export function MobileFeedbackComposer({ composer, flow, header, onClose }: Props) {
  const keyboardPadding = useKeyboardAvoidingPadding()
  const pickerActions = useMemo(
    () =>
      buildAgentTargetActions({
        terminals:
          composer.picker?.kind === 'ready' || composer.picker?.kind === 'error'
            ? composer.picker.terminals
            : [],
        sendDisabled: composer.sending,
        copyLabel: 'Copy Feedback',
        copyDisabled: composer.sending,
        onSendToTerminal: flow.sendToTerminal,
        onNewSession: flow.sendToNewSession,
        onCopy: () => void flow.copyFeedback()
      }),
    [composer.picker, composer.sending, flow]
  )

  if (composer.picker) {
    return (
      <View>
        <ActionSheetContent
          title="Send to agent"
          message={
            composer.picker.kind === 'loading'
              ? 'Loading agent sessions...'
              : composer.picker.kind === 'error'
                ? composer.picker.message
                : 'Uploads the screenshot, pastes the feedback and presses Enter'
          }
          actions={pickerActions}
        />
        <Pressable
          style={({ pressed }) => [styles.secondary, styles.buttons, pressed && styles.pressed]}
          onPress={() => flow.dispatch({ type: 'picker', picker: null })}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    )
  }

  const count = composer.comment.length
  const { image } = composer
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={keyboardPadding > 0 ? { paddingBottom: keyboardPadding } : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Design feedback</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {feedbackPageHeading(header.pageUrl)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Discard feedback"
        >
          <X size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.summary}>
        <Image
          source={{ uri: image.uri }}
          style={[styles.thumbnail, { aspectRatio: image.width / image.height }]}
          resizeMode="cover"
          accessibilityLabel="Screenshot to send"
        />
        <View style={styles.summaryColumn}>
          <View style={styles.segment} accessibilityRole="tablist">
            {INTENTS.map(({ intent, label }) => {
              const active = composer.intent === intent
              const Icon = intent === 'change' ? Wrench : CircleQuestionMark
              return (
                <Pressable
                  key={intent}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  onPress={() => flow.dispatch({ type: 'set-intent', intent })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Icon size={13} color={active ? colors.bgBase : colors.textSecondary} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.imageMeta}>
            {`${image.width}x${image.height} px${image.markedUp ? ' · marked up' : ''}`}
          </Text>
        </View>
      </View>
      <TextInput
        style={styles.input}
        value={composer.comment}
        onChangeText={(comment) => flow.dispatch({ type: 'set-comment', comment })}
        maxLength={FEEDBACK_COMMENT_MAX_CHARS}
        multiline
        placeholder={
          composer.intent === 'change' ? 'What should change?' : 'What do you want to ask?'
        }
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Feedback comment"
      />
      <Text style={[styles.counter, count >= FEEDBACK_COMMENT_MAX_CHARS && styles.counterFull]}>
        {`${count.toLocaleString('en-US')} / ${FEEDBACK_COMMENT_MAX_CHARS.toLocaleString('en-US')}`}
      </Text>
      <View style={styles.details}>
        <Text style={styles.detailsTitle}>Sent with the feedback</Text>
        {feedbackHeaderRows(header).map(([name, value]) => (
          <View key={name} style={styles.detailRow}>
            <Text style={styles.detailName}>{name}</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      {composer.error ? <Text style={styles.error}>{composer.error}</Text> : null}
      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={onClose}
          disabled={composer.sending}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Discard</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
            composer.sending && styles.disabled
          ]}
          onPress={() => void flow.openPicker()}
          disabled={composer.sending}
          accessibilityRole="button"
          accessibilityLabel="Send to agent"
        >
          {composer.sending ? (
            <ActivityIndicator size="small" color={colors.bgBase} />
          ) : (
            <Send size={15} color={colors.bgBase} strokeWidth={2.2} />
          )}
          <Text style={styles.primaryText}>{composer.sending ? 'Sending…' : 'Send to agent'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
