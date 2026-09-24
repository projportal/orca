/**
 * Touch-target sizes for the feedback UI, in points. Every control's Pressable is itself at least
 * 44 x 44 and draws a smaller glyph centred inside it, so no hit area depends on `hitSlop` (which
 * a short parent row would clip). Rows are at least 44 tall and frames sit edge to edge, so the
 * glyphs keep their visual spacing. The toolbar test renders against these numbers.
 */
export const FEEDBACK_MIN_TOUCH = 44

export type TouchFrame = { width: number; height: number }

/** Tool buttons, Undo and colour swatches: a square touch target. */
export const MARKUP_TARGET_FRAME: TouchFrame = {
  width: FEEDBACK_MIN_TOUCH,
  height: FEEDBACK_MIN_TOUCH
}
/** The visible parts drawn inside a target. */
export const MARKUP_ICON_GLYPH: TouchFrame = { width: 34, height: 32 }
export const MARKUP_SWATCH_GLYPH: TouchFrame = { width: 26, height: 26 }
export const MARKUP_PILL_GLYPH_HEIGHT = 32
/** Cancel and Done: text pills, a full target tall around a 32 pt pill. */
export const MARKUP_CANCEL_FRAME: TouchFrame = { width: 72, height: FEEDBACK_MIN_TOUCH }
export const MARKUP_PILL_FRAME: TouchFrame = { width: 76, height: FEEDBACK_MIN_TOUCH }
export const MARKUP_ROW_MIN_HEIGHT = FEEDBACK_MIN_TOUCH
/** Frames abut; the glyph insets give the visual gap. */
export const MARKUP_TOOL_GAP = 0
export const MARKUP_SWATCH_GAP = 0
export const MARKUP_ROW_GAP = 0

/** Thumbnail action chips are a full touch target tall, stacked with a small gap. */
export const FEEDBACK_CHIP_HEIGHT = FEEDBACK_MIN_TOUCH
export const FEEDBACK_CHIP_GAP = 4

/** Screen width the toolbar rows must fit: iPhone 17 Pro, portrait. */
export const FEEDBACK_LAYOUT_WIDTH = 402
