import { describe, expect, it } from 'vitest'
import {
  arrowHeadLength,
  arrowHeadPoints,
  canvasToImagePoint,
  clampRect,
  computeContainFit,
  cropCornerAt,
  cropRectToPixels,
  MARKUP_CROP_HANDLE_HIT_POINTS,
  MARKUP_CROP_HANDLE_POINTS,
  oppositeCropCorner,
  flattenCaptureSize,
  normalizeRect,
  pointsToImagePixels,
  polylinePathData
} from './markup-geometry'
import { shouldForwardBrowserTouch } from './markup-input-gate'
import { markupToolHint } from './markup-tool-hint'
import {
  canUndoMarkup,
  createMarkupState,
  draftShape,
  markupHasEdits,
  markupReducer,
  type MarkupAction,
  type MarkupState
} from './markup-model'

function run(actions: MarkupAction[], state: MarkupState = createMarkupState()): MarkupState {
  return actions.reduce(markupReducer, state)
}

describe('markup geometry', () => {
  it('fits a portrait frame inside the viewport and centres it', () => {
    const fit = computeContainFit({ width: 400, height: 600 }, { width: 1200, height: 2400 })
    expect(fit).toEqual({ x: 50, y: 0, width: 300, height: 600, scale: 0.25 })
  })

  it('refuses an empty box or image', () => {
    expect(computeContainFit({ width: 0, height: 10 }, { width: 10, height: 10 })).toBeNull()
    expect(computeContainFit({ width: 10, height: 10 }, { width: 10, height: 0 })).toBeNull()
  })

  it('maps a canvas touch to image pixels and clamps it to the image', () => {
    const fit = computeContainFit({ width: 300, height: 600 }, { width: 1200, height: 2400 })!
    const image = { width: 1200, height: 2400 }
    expect(canvasToImagePoint({ x: 150, y: 300 }, fit, image)).toEqual({ x: 600, y: 1200 })
    expect(canvasToImagePoint({ x: -5, y: 900 }, fit, image)).toEqual({ x: 0, y: 2400 })
    expect(pointsToImagePixels(3, fit)).toBe(12)
  })

  it('normalizes and clamps rectangles', () => {
    expect(normalizeRect({ x: 10, y: 50 }, { x: 4, y: 20 })).toEqual({
      x: 4,
      y: 20,
      width: 6,
      height: 30
    })
    expect(clampRect({ x: -10, y: 5, width: 50, height: 500 }, { width: 30, height: 100 })).toEqual(
      { x: 0, y: 5, width: 30, height: 95 }
    )
  })

  it('draws the arrow head back along the shaft, symmetric about it', () => {
    const [left, right] = arrowHeadPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, Math.PI / 4)
    expect(left.x).toBeCloseTo(100 - 20 * Math.SQRT1_2)
    expect(right.x).toBeCloseTo(left.x)
    expect(left.y).toBeCloseTo(-right.y)
    expect(Math.hypot(100 - left.x, left.y)).toBeCloseTo(20)
    // Never longer than 45% of a short shaft, never shorter than 4 strokes on a long one.
    expect(arrowHeadLength({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)).toBe(4.5)
    expect(arrowHeadLength({ x: 0, y: 0 }, { x: 1000, y: 0 }, 6)).toBe(24)
  })

  it('writes pen strokes as SVG path data, a tap as a dot', () => {
    expect(
      polylinePathData([
        { x: 1, y: 2 },
        { x: 3.456, y: 4 }
      ])
    ).toBe('M1 2 L3.46 4')
    expect(polylinePathData([{ x: 5, y: 5 }])).toBe('M5 5 L5 5')
    expect(polylinePathData([])).toBe('')
  })

  it('asks view-shot for points that come out at the frame resolution', () => {
    expect(flattenCaptureSize({ width: 1206, height: 2148 }, 3)).toEqual({
      width: 402,
      height: 716
    })
    expect(flattenCaptureSize({ width: 100, height: 50 }, 0)).toEqual({ width: 100, height: 50 })
  })

  it('turns a crop into whole pixels inside the image and drops a no-op or tiny crop', () => {
    const image = { width: 1000, height: 800 }
    expect(cropRectToPixels({ x: 10.7, y: 20.2, width: 300.4, height: 200.6 }, image)).toEqual({
      originX: 10,
      originY: 20,
      width: 300,
      height: 201
    })
    expect(cropRectToPixels({ x: 900, y: 700, width: 500, height: 500 }, image)).toEqual({
      originX: 900,
      originY: 700,
      width: 100,
      height: 100
    })
    expect(cropRectToPixels({ x: 0, y: 0, width: 1000, height: 800 }, image)).toBeNull()
    expect(cropRectToPixels({ x: 5, y: 5, width: 8, height: 400 }, image)).toBeNull()
  })
})

describe('markup model', () => {
  it('commits a dragged arrow with the current colour and stroke', () => {
    const state = run([
      { type: 'set-color', color: '#0a84ff' },
      { type: 'begin', point: { x: 10, y: 10 }, strokeWidth: 9 },
      { type: 'extend', point: { x: 60, y: 40 } },
      { type: 'extend', point: { x: 110, y: 90 } },
      { type: 'end', minSize: 12 }
    ])
    expect(state.shapes).toEqual([
      {
        id: 1,
        kind: 'arrow',
        color: '#0a84ff',
        width: 9,
        from: { x: 10, y: 10 },
        to: { x: 110, y: 90 }
      }
    ])
    expect(state.draft).toBeNull()
  })

  it('keeps the first corner of a box when it is dragged up and left', () => {
    const state = run([
      { type: 'set-tool', tool: 'rect' },
      { type: 'begin', point: { x: 100, y: 100 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 150, y: 150 } },
      { type: 'extend', point: { x: 40, y: 20 } },
      { type: 'end', minSize: 12 }
    ])
    expect(state.shapes).toEqual([
      {
        id: 1,
        kind: 'rect',
        color: '#ff3b30',
        width: 3,
        rect: { x: 40, y: 20, width: 60, height: 80 }
      }
    ])
  })

  it('shows the draft under the finger before it commits', () => {
    const state = run([
      { type: 'set-tool', tool: 'rect' },
      { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 20, y: 30 } }
    ])
    expect(draftShape(state.draft!)).toMatchObject({ rect: { width: 20, height: 30 } })
  })

  it('drops a stray arrow or box smaller than the floor, keeps a pen dot', () => {
    const tiny = (tool: 'arrow' | 'rect' | 'pen') =>
      run([
        { type: 'set-tool', tool },
        { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
        { type: 'extend', point: { x: 2, y: 2 } },
        { type: 'end', minSize: 12 }
      ]).shapes.length
    expect(tiny('arrow')).toBe(0)
    expect(tiny('rect')).toBe(0)
    expect(tiny('pen')).toBe(1)
  })

  it('places a trimmed text label and ignores an empty one', () => {
    const state = run([
      { type: 'set-tool', tool: 'text' },
      { type: 'begin', point: { x: 5, y: 5 }, strokeWidth: 3 },
      { type: 'add-text', at: { x: 30, y: 40 }, text: '  too small  ', fontSize: 48 },
      { type: 'add-text', at: { x: 30, y: 40 }, text: '   ', fontSize: 48 }
    ])
    expect(state.draft).toBeNull()
    expect(state.shapes).toEqual([
      {
        id: 1,
        kind: 'text',
        color: '#ff3b30',
        fontSize: 48,
        at: { x: 30, y: 40 },
        text: 'too small'
      }
    ])
  })

  it('sets a crop from a drag and undoes shapes and crops in the order they were made', () => {
    let state = run([
      { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 100, y: 100 } },
      { type: 'end', minSize: 12 },
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 200, y: 300 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 20, y: 30 } },
      { type: 'end', minSize: 12 }
    ])
    expect(state.crop).toEqual({ x: 20, y: 30, width: 180, height: 270 })
    expect(state.shapes).toHaveLength(1)
    expect(markupHasEdits(state)).toBe(true)

    state = markupReducer(state, { type: 'undo' })
    expect(state.crop).toBeNull()
    expect(state.shapes).toHaveLength(1)
    state = markupReducer(state, { type: 'undo' })
    expect(state.shapes).toHaveLength(0)
    expect(canUndoMarkup(state)).toBe(false)
    expect(markupHasEdits(state)).toBe(false)
    expect(markupReducer(state, { type: 'undo' })).toBe(state)
  })

  it('never reuses a shape id after undo, so render keys stay stable', () => {
    const arrow = (from: number): MarkupAction[] => [
      { type: 'begin', point: { x: from, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: from + 100, y: 100 } },
      { type: 'end', minSize: 12 }
    ]
    let state = run([...arrow(0), ...arrow(10)])
    expect(state.shapes.map((shape) => shape.id)).toEqual([1, 2])
    state = markupReducer(state, { type: 'undo' })
    state = run(arrow(20), state)
    expect(state.shapes.map((shape) => shape.id)).toEqual([1, 3])
  })

  it('makes resetting the crop undoable', () => {
    let state = run([
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 50, y: 50 } },
      { type: 'end', minSize: 12 },
      { type: 'reset-crop' }
    ])
    expect(state.crop).toBeNull()
    state = markupReducer(state, { type: 'undo' })
    expect(state.crop).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })

  it('ignores a crop smaller than the pixel floor', () => {
    const state = run([
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 10, y: 400 } },
      { type: 'end', minSize: 12 }
    ])
    expect(state.crop).toBeNull()
    expect(canUndoMarkup(state)).toBe(false)
  })
})

describe('input gating', () => {
  it('forwards touches only when neither markup nor a page dialog holds the viewport', () => {
    expect(shouldForwardBrowserTouch({ dialogOpen: false, markupArmed: false })).toBe(true)
    expect(shouldForwardBrowserTouch({ dialogOpen: false, markupArmed: true })).toBe(false)
    expect(shouldForwardBrowserTouch({ dialogOpen: true, markupArmed: false })).toBe(false)
  })
})

describe('crop corner handles', () => {
  const crop = { x: 100, y: 200, width: 600, height: 400 }
  // 3 image pixels per point: a 44 pt hit square reaches 66 px either side of a corner.
  const fit = { scale: 1 / 3 }

  it('grabs the nearest corner inside its 44 pt hit square and nothing outside', () => {
    expect(cropCornerAt({ x: 110, y: 190 }, crop, fit)).toBe('top-left')
    expect(cropCornerAt({ x: 760, y: 610 }, crop, fit)).toBe('bottom-right')
    expect(cropCornerAt({ x: 700 - 66, y: 200 + 66 }, crop, fit)).toBe('top-right')
    expect(cropCornerAt({ x: 100 + 67, y: 200 }, crop, fit)).toBeNull()
    expect(cropCornerAt({ x: 400, y: 400 }, crop, fit)).toBeNull()
    expect(MARKUP_CROP_HANDLE_POINTS).toBe(24)
    expect(MARKUP_CROP_HANDLE_HIT_POINTS).toBe(44)
    expect(oppositeCropCorner(crop, 'top-left')).toEqual({ x: 700, y: 600 })
    expect(oppositeCropCorner(crop, 'bottom-left')).toEqual({ x: 700, y: 200 })
  })

  it('resizes from a corner, anchored on the opposite one, and undoes to the old crop', () => {
    const cropped = run([
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 100, y: 200 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 700, y: 600 } },
      { type: 'end', minSize: 12 }
    ])
    expect(cropped.crop).toEqual(crop)
    const resized = run(
      [
        { type: 'begin-crop-resize', anchor: { x: 100, y: 200 }, point: { x: 700, y: 600 } },
        { type: 'extend', point: { x: 500, y: 450 } },
        { type: 'end', minSize: 12 }
      ],
      cropped
    )
    expect(resized.crop).toEqual({ x: 100, y: 200, width: 400, height: 250 })
    expect(run([{ type: 'undo' }], resized).crop).toEqual(crop)
  })

  it('ignores a corner grab with no crop or outside the crop tool', () => {
    const action: MarkupAction = {
      type: 'begin-crop-resize',
      anchor: { x: 0, y: 0 },
      point: { x: 10, y: 10 }
    }
    const idle = createMarkupState()
    expect(markupReducer(idle, action)).toBe(idle)
  })

  it('words the crop hint for the gesture that is live', () => {
    expect(markupToolHint('crop', false)).toBe('Drag to select the area')
    expect(markupToolHint('crop', true)).toBe('Drag a corner to resize')
    expect(markupToolHint('pen', false)).toBe('Draw freehand')
  })
})
