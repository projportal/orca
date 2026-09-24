import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Check,
  Crop,
  MoveUpRight,
  Pencil,
  Square,
  Type,
  Undo2,
  type LucideIcon
} from 'lucide-react-native'
import { colors, radii, spacing } from '../theme/mobile-theme'
import {
  MARKUP_CANCEL_FRAME,
  MARKUP_ICON_FRAME,
  MARKUP_PILL_FRAME,
  MARKUP_ROW_GAP,
  MARKUP_SWATCH_FRAME,
  MARKUP_SWATCH_GAP,
  MARKUP_TOOL_GAP,
  touchHitSlop
} from './feedback-touch-targets'
import { markupToolHint } from './markup-tool-hint'
import { MARKUP_COLORS, type MarkupTool } from './markup-model'

const TOOLS: { tool: MarkupTool; label: string; icon: LucideIcon }[] = [
  { tool: 'pen', label: 'Pen', icon: Pencil },
  { tool: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { tool: 'rect', label: 'Box', icon: Square },
  { tool: 'text', label: 'Text', icon: Type },
  { tool: 'crop', label: 'Crop', icon: Crop }
]

const ICON_SLOP = touchHitSlop(MARKUP_ICON_FRAME)
const SWATCH_SLOP = touchHitSlop(MARKUP_SWATCH_FRAME)
const PILL_SLOP = touchHitSlop(MARKUP_PILL_FRAME)
const CANCEL_SLOP = touchHitSlop(MARKUP_CANCEL_FRAME)

type Props = {
  tool: MarkupTool
  color: string
  canUndo: boolean
  hasCrop: boolean
  busy: boolean
  onTool: (tool: MarkupTool) => void
  onColor: (color: string) => void
  onUndo: () => void
  onResetCrop: () => void
  onCancel: () => void
  onDone: () => void
}

export function MobileMarkupToolbar(props: Props) {
  const { tool, color, canUndo, hasCrop, busy } = props
  const cropping = tool === 'crop'
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.cancel,
            pressed && styles.pressed,
            busy && styles.disabled
          ]}
          onPress={props.onCancel}
          disabled={busy}
          hitSlop={CANCEL_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Cancel markup"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <View style={styles.actions}>
          <IconButton
            label="Undo"
            icon={Undo2}
            onPress={props.onUndo}
            disabled={busy || !canUndo}
          />
          <Pressable
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            onPress={props.onDone}
            disabled={busy}
            hitSlop={PILL_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.bgBase} />
            ) : (
              <Check size={16} color={colors.bgBase} strokeWidth={2.6} />
            )}
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.tools}>
          {TOOLS.map((entry) => (
            <IconButton
              key={entry.tool}
              label={entry.label}
              icon={entry.icon}
              active={entry.tool === tool}
              onPress={() => props.onTool(entry.tool)}
              disabled={busy}
            />
          ))}
        </View>
        <Text style={styles.hint} numberOfLines={1}>
          {markupToolHint(tool, hasCrop)}
        </Text>
      </View>
      {cropping && !hasCrop ? null : (
        <View style={styles.row}>
          {/* Colour does nothing to a crop, so the swatches step aside while cropping. */}
          {cropping ? (
            <View />
          ) : (
            <View style={styles.swatches}>
              {MARKUP_COLORS.map((swatch) => (
                <Pressable
                  key={swatch}
                  onPress={() => props.onColor(swatch)}
                  hitSlop={SWATCH_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${swatch}`}
                  accessibilityState={{ selected: swatch === color }}
                  style={[styles.swatch, swatch === color && styles.swatchActive]}
                >
                  <View style={[styles.swatchFill, { backgroundColor: swatch }]} />
                </Pressable>
              ))}
            </View>
          )}
          {hasCrop ? (
            <Pressable
              onPress={props.onResetCrop}
              hitSlop={PILL_SLOP}
              accessibilityRole="button"
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonLabel}>Reset crop</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  )
}

function IconButton(props: {
  label: string
  icon: LucideIcon
  onPress: () => void
  active?: boolean
  disabled?: boolean
}) {
  const Icon = props.icon
  return (
    <Pressable
      style={({ pressed }) => [
        styles.icon,
        props.active && styles.iconActive,
        pressed && styles.pressed,
        props.disabled && styles.disabled
      ]}
      onPress={props.onPress}
      disabled={props.disabled}
      hitSlop={ICON_SLOP}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active === true, disabled: props.disabled === true }}
    >
      <Icon size={17} color={props.active ? colors.bgBase : colors.textPrimary} strokeWidth={2.2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: MARKUP_ROW_GAP,
    backgroundColor: colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: MARKUP_TOOL_GAP },
  tools: { flexDirection: 'row', gap: MARKUP_TOOL_GAP },
  icon: {
    ...MARKUP_ICON_FRAME,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconActive: { backgroundColor: colors.textPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  cancel: {
    minWidth: MARKUP_CANCEL_FRAME.width,
    height: MARKUP_CANCEL_FRAME.height,
    paddingHorizontal: spacing.md,
    borderRadius: MARKUP_CANCEL_FRAME.height / 2,
    backgroundColor: colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  done: {
    minWidth: MARKUP_PILL_FRAME.width,
    height: MARKUP_PILL_FRAME.height,
    paddingHorizontal: spacing.md,
    borderRadius: MARKUP_PILL_FRAME.height / 2,
    backgroundColor: colors.statusGreen,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneText: { color: colors.bgBase, fontSize: 14, fontWeight: '700' },
  swatches: { flexDirection: 'row', gap: MARKUP_SWATCH_GAP },
  swatch: {
    ...MARKUP_SWATCH_FRAME,
    borderRadius: MARKUP_SWATCH_FRAME.width / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  swatchActive: { borderColor: colors.textPrimary },
  swatchFill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  hint: {
    flex: 1,
    marginLeft: spacing.md,
    textAlign: 'right',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500'
  },
  textButton: {
    minWidth: MARKUP_PILL_FRAME.width,
    height: MARKUP_PILL_FRAME.height,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textButtonLabel: { color: colors.accentBlue, fontSize: 14, fontWeight: '600' }
})
