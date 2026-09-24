import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_CHIP_GAP,
  FEEDBACK_CHIP_HEIGHT,
  FEEDBACK_MIN_TOUCH,
  MARKUP_CANCEL_FRAME,
  MARKUP_ICON_FRAME,
  MARKUP_PILL_FRAME,
  MARKUP_ROW_GAP,
  MARKUP_SWATCH_FRAME,
  MARKUP_SWATCH_GAP,
  MARKUP_TOOL_GAP,
  rowHitBoxes,
  touchBoxesOverlap,
  touchHitSlop,
  type TouchBox,
  type TouchFrame
} from './feedback-touch-targets'
import { MARKUP_COLORS } from './markup-model'

function expectDistinctTargets(boxes: TouchBox[]) {
  for (const box of boxes) {
    expect(box.right - box.left).toBeGreaterThanOrEqual(FEEDBACK_MIN_TOUCH)
    expect(box.bottom - box.top).toBeGreaterThanOrEqual(FEEDBACK_MIN_TOUCH)
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      expect(touchBoxesOverlap(boxes[i], boxes[j])).toBe(false)
    }
  }
}

describe('feedback touch targets', () => {
  it('grows small frames to 44 x 44 and leaves big ones alone', () => {
    expect(touchHitSlop(MARKUP_ICON_FRAME)).toEqual({ top: 6, bottom: 6, left: 5, right: 5 })
    expect(touchHitSlop(MARKUP_SWATCH_FRAME)).toEqual({ top: 9, bottom: 9, left: 9, right: 9 })
    expect(touchHitSlop({ width: 80, height: 50 })).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    })
  })

  it('keeps the five tools and Undo on distinct, non-overlapping hit areas', () => {
    expectDistinctTargets(rowHitBoxes(Array(5).fill(MARKUP_ICON_FRAME), MARKUP_TOOL_GAP))
  })

  it('keeps the six colour swatches on distinct, non-overlapping hit areas', () => {
    const frames: TouchFrame[] = MARKUP_COLORS.map(() => MARKUP_SWATCH_FRAME)
    expectDistinctTargets(rowHitBoxes(frames, MARKUP_SWATCH_GAP))
  })

  it('keeps Undo and Done apart, and Cancel a full target', () => {
    expectDistinctTargets(rowHitBoxes([MARKUP_ICON_FRAME, MARKUP_PILL_FRAME], MARKUP_TOOL_GAP))
    expectDistinctTargets(rowHitBoxes([MARKUP_CANCEL_FRAME], 0))
  })

  it('stacks the toolbar rows without their hit areas meeting', () => {
    const actions = rowHitBoxes([MARKUP_CANCEL_FRAME], 0)
    const toolsTop = MARKUP_CANCEL_FRAME.height + MARKUP_ROW_GAP
    const tools = rowHitBoxes(Array(5).fill(MARKUP_ICON_FRAME), MARKUP_TOOL_GAP, toolsTop)
    const swatchesTop = toolsTop + MARKUP_ICON_FRAME.height + MARKUP_ROW_GAP
    const swatches = rowHitBoxes(
      MARKUP_COLORS.map(() => MARKUP_SWATCH_FRAME),
      MARKUP_SWATCH_GAP,
      swatchesTop
    )
    expectDistinctTargets([...actions, ...tools, ...swatches])
  })

  it('makes the thumbnail action chips full-height targets with a gap between', () => {
    const chip = { width: 150, height: FEEDBACK_CHIP_HEIGHT }
    let top = 0
    const boxes = [chip, chip, chip].map((frame) => {
      const [box] = rowHitBoxes([frame], 0, top)
      top += frame.height + FEEDBACK_CHIP_GAP
      return box
    })
    expect(FEEDBACK_CHIP_HEIGHT).toBeGreaterThanOrEqual(44)
    expectDistinctTargets(boxes)
  })
})
