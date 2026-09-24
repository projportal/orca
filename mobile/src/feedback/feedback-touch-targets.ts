/**
 * Touch-target sizes for the feedback UI, in points. Frames keep their visual size; `hitSlop`
 * grows each hit area to at least 44 x 44, and row gaps are wide enough that neighbours' hit
 * areas never overlap. The toolbar test checks these numbers, so change them here only.
 */
export const FEEDBACK_MIN_TOUCH = 44

export type TouchFrame = { width: number; height: number }
export type TouchInsets = { top: number; bottom: number; left: number; right: number }
export type TouchBox = { left: number; top: number; right: number; bottom: number }

export const MARKUP_ICON_FRAME: TouchFrame = { width: 34, height: 32 }
export const MARKUP_SWATCH_FRAME: TouchFrame = { width: 26, height: 26 }
/** Cancel and Done: text pills, at least as wide as a touch target. */
export const MARKUP_PILL_FRAME: TouchFrame = { width: 76, height: 32 }
export const MARKUP_CANCEL_FRAME: TouchFrame = { width: 72, height: 32 }
/** Thumbnail action chips are a full touch target tall; no slop needed. */
export const FEEDBACK_CHIP_HEIGHT = FEEDBACK_MIN_TOUCH
export const FEEDBACK_CHIP_GAP = 4

/** Symmetric slop that grows `frame` to the minimum touch size (zero where it already is). */
export function touchHitSlop(frame: TouchFrame, min: number = FEEDBACK_MIN_TOUCH): TouchInsets {
  const x = Math.max(0, (min - frame.width) / 2)
  const y = Math.max(0, (min - frame.height) / 2)
  return { top: y, bottom: y, left: x, right: x }
}

/** Smallest gap between two frames in a row so their slopped hit areas do not overlap. */
export function touchRowGap(a: TouchFrame, b: TouchFrame = a): number {
  return touchHitSlop(a).right + touchHitSlop(b).left
}

export const MARKUP_TOOL_GAP = touchRowGap(MARKUP_ICON_FRAME)
export const MARKUP_SWATCH_GAP = touchRowGap(MARKUP_SWATCH_FRAME)
/** Vertical gap between toolbar rows: the tallest slop above plus the tallest below. */
export const MARKUP_ROW_GAP =
  Math.max(touchHitSlop(MARKUP_ICON_FRAME).bottom, touchHitSlop(MARKUP_SWATCH_FRAME).bottom) +
  Math.max(touchHitSlop(MARKUP_ICON_FRAME).top, touchHitSlop(MARKUP_SWATCH_FRAME).top)

/** The hit boxes of frames laid out left to right with `gap` between frames, top-aligned. */
export function rowHitBoxes(frames: readonly TouchFrame[], gap: number, top = 0): TouchBox[] {
  let x = 0
  return frames.map((frame) => {
    const slop = touchHitSlop(frame)
    const box = {
      left: x - slop.left,
      top: top - slop.top,
      right: x + frame.width + slop.right,
      bottom: top + frame.height + slop.bottom
    }
    x += frame.width + gap
    return box
  })
}

export function touchBoxesOverlap(a: TouchBox, b: TouchBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}
