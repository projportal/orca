import { StyleSheet } from 'react-native'
import { TEXT_INPUT_FONT_SIZE } from '../platform/text-input-font-size'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { FEEDBACK_MIN_TOUCH } from './feedback-touch-targets'

export const feedbackComposerStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: typography.metaSize, marginTop: 2 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  summary: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  thumbnailButton: { width: 80, minHeight: FEEDBACK_MIN_TOUCH, justifyContent: 'center' },
  thumbnail: {
    width: 80,
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  viewBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(10,10,10,0.82)'
  },
  viewBadgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  summaryColumn: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgRaised,
    borderRadius: radii.button,
    padding: 2
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: radii.button - 1
  },
  segmentItemActive: { backgroundColor: colors.textPrimary },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.bgBase },
  input: {
    marginTop: spacing.md,
    minHeight: 96,
    maxHeight: 160,
    borderRadius: radii.input,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: TEXT_INPUT_FONT_SIZE,
    textAlignVertical: 'top'
  },
  counter: {
    alignSelf: 'flex-end',
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4
  },
  counterFull: { color: colors.statusAmber },
  details: {
    marginTop: spacing.xs,
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
    paddingBottom: 2
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: FEEDBACK_MIN_TOUCH
  },
  detailsTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  detailRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  detailName: { width: 96, color: colors.textMuted, fontSize: 11 },
  detailValue: { flex: 1, color: colors.textSecondary, fontSize: 11 },
  error: { color: colors.statusRed, fontSize: typography.metaSize, marginTop: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondary: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  secondaryText: { color: colors.textSecondary, fontSize: typography.bodySize, fontWeight: '600' },
  primary: {
    flex: 2,
    minHeight: 40,
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary
  },
  primaryText: { color: colors.bgBase, fontSize: typography.bodySize, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  deliveredHead: { alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  deliveredTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  deliveredTarget: { color: colors.textSecondary, fontSize: 13 },
  listTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  listThumb: { width: 30, height: 44, borderRadius: 4, backgroundColor: colors.bgRaised },
  listText: { flex: 1, minWidth: 0 },
  listPage: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  listComment: { color: colors.textMuted, fontSize: 12 },
  chip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' }
})
