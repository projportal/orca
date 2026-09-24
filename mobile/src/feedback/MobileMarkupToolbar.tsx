import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Check,
  Crop,
  MoveUpRight,
  Pencil,
  Square,
  Type,
  Undo2,
  X,
  type LucideIcon
} from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MARKUP_COLORS, type MarkupTool } from './markup-model'

const TOOLS: { tool: MarkupTool; label: string; icon: LucideIcon }[] = [
  { tool: 'pen', label: 'Pen', icon: Pencil },
  { tool: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { tool: 'rect', label: 'Box', icon: Square },
  { tool: 'text', label: 'Text', icon: Type },
  { tool: 'crop', label: 'Crop', icon: Crop }
]

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
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <IconButton label="Cancel markup" icon={X} onPress={props.onCancel} disabled={busy} />
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
        <IconButton label="Undo" icon={Undo2} onPress={props.onUndo} disabled={busy || !canUndo} />
        <Pressable
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          onPress={props.onDone}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Done marking up"
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.bgBase} />
          ) : (
            <Check size={16} color={colors.bgBase} strokeWidth={2.6} />
          )}
        </Pressable>
      </View>
      <View style={styles.row}>
        <View style={styles.swatches}>
          {MARKUP_COLORS.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => props.onColor(swatch)}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${swatch}`}
              accessibilityState={{ selected: swatch === color }}
              style={[styles.swatch, swatch === color && styles.swatchActive]}
            >
              <View style={[styles.swatchFill, { backgroundColor: swatch }]} />
            </Pressable>
          ))}
        </View>
        {hasCrop ? (
          <Pressable
            onPress={props.onResetCrop}
            accessibilityRole="button"
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Reset crop</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>{hintFor(tool)}</Text>
        )}
      </View>
    </View>
  )
}

function hintFor(tool: MarkupTool): string {
  switch (tool) {
    case 'pen':
      return 'Draw freehand'
    case 'arrow':
      return 'Drag to point'
    case 'rect':
      return 'Drag a box'
    case 'text':
      return 'Tap to label'
    case 'crop':
      return 'Drag the area to keep'
  }
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tools: { flexDirection: 'row', gap: 2 },
  icon: {
    width: 34,
    height: 32,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconActive: { backgroundColor: colors.textPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  done: {
    width: 40,
    height: 32,
    borderRadius: radii.button,
    backgroundColor: colors.statusGreen,
    alignItems: 'center',
    justifyContent: 'center'
  },
  swatches: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  hint: { color: colors.textMuted, fontSize: typography.metaSize, paddingRight: spacing.xs },
  textButton: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  textButtonLabel: { color: colors.accentBlue, fontSize: typography.metaSize, fontWeight: '600' }
})
