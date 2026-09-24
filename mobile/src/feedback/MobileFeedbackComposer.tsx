import { useEffect, useMemo, useState } from 'react'
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
import { CircleQuestionMark, Eye, Send, Wrench, X } from 'lucide-react-native'
import { ActionSheetContent } from '../components/ActionSheetModal'
import { buildAgentTargetActions } from '../components/agent-target-actions'
import { useKeyboardAvoidingPadding } from '../platform/keyboard-occlusion'
import { colors } from '../theme/mobile-theme'
import { feedbackComposerImageUri, type FeedbackComposer } from './feedback-flow'
import {
  FEEDBACK_COMMENT_MAX_CHARS,
  feedbackComposerDetailRows,
  feedbackPageHeading,
  type FeedbackHeader,
  type FeedbackIntent
} from './feedback-message'
import { feedbackComposerStyles as styles } from './feedback-composer-styles'
import { MobileFeedbackDetails } from './MobileFeedbackDetails'
import { MobileFeedbackImageViewer } from './MobileFeedbackImageViewer'
import type { MobileFeedbackFlow } from './use-mobile-feedback-flow'

type Props = {
  composer: FeedbackComposer
  flow: MobileFeedbackFlow
  header: FeedbackHeader
  onClose: () => void
  /** Demo route only: open Details or the full-screen viewer on first paint. */
  initialDetailsOpen?: boolean
  initialViewerOpen?: boolean
}

const INTENTS: { intent: FeedbackIntent; label: string }[] = [
  { intent: 'change', label: 'Change' },
  { intent: 'question', label: 'Question' }
]

export const FEEDBACK_PICKER_CAPTION = 'Tap an agent to send now'

/**
 * The feedback sheet: the attachment, intent, comment, and "Send to agent"; the technical header
 * sits under Details. The target picker is the review-notes sheet's rows, shown in place so only
 * one native sheet is ever up.
 */
export function MobileFeedbackComposer({
  composer,
  flow,
  header,
  onClose,
  initialDetailsOpen,
  initialViewerOpen
}: Props) {
  const keyboardPadding = useKeyboardAvoidingPadding()
  const [viewerOpen, setViewerOpen] = useState(false)
  // Why: iOS will not present a second modal while the sheet's own is still presenting.
  useEffect(() => {
    if (!initialViewerOpen) {
      return
    }
    const timer = setTimeout(() => setViewerOpen(true), 900)
    return () => clearTimeout(timer)
  }, [initialViewerOpen])
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
                : FEEDBACK_PICKER_CAPTION
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
  // Preview and upload read the same file: markup's flattened, cropped output.
  const imageUri = feedbackComposerImageUri(composer)
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
          hitSlop={7}
          accessibilityRole="button"
          accessibilityLabel="Discard feedback"
        >
          <X size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.summary}>
        <Pressable
          style={({ pressed }) => [styles.thumbnailButton, pressed && styles.pressed]}
          onPress={() => setViewerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="View screenshot"
        >
          <Image
            source={{ uri: imageUri }}
            style={[styles.thumbnail, { aspectRatio: image.width / image.height }]}
            resizeMode="cover"
          />
          <View style={styles.viewBadge} pointerEvents="none">
            <Eye size={11} color={colors.textPrimary} strokeWidth={2.4} />
            <Text style={styles.viewBadgeText}>View</Text>
          </View>
        </Pressable>
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
      <MobileFeedbackDetails
        rows={feedbackComposerDetailRows(image, header)}
        initiallyOpen={initialDetailsOpen}
      />
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
      <MobileFeedbackImageViewer
        visible={viewerOpen}
        image={image}
        onClose={() => setViewerOpen(false)}
        onEditMarkup={
          composer.sending
            ? undefined
            : () => {
                setViewerOpen(false)
                flow.dispatch({ type: 'edit-markup' })
              }
        }
      />
    </KeyboardAvoidingView>
  )
}
