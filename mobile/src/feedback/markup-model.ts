import {
  MARKUP_MIN_CROP_PIXELS,
  normalizeRect,
  type MarkupPoint,
  type MarkupRect
} from './markup-geometry'

export type MarkupTool = 'pen' | 'arrow' | 'rect' | 'text' | 'crop'

export const MARKUP_COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#111111']

/** Every shape is stored in image pixels, so drawing and flattening share one coordinate space. */
export type MarkupShape =
  | { kind: 'pen'; color: string; width: number; points: MarkupPoint[] }
  | { kind: 'arrow'; color: string; width: number; from: MarkupPoint; to: MarkupPoint }
  | { kind: 'rect'; color: string; width: number; rect: MarkupRect }
  | { kind: 'text'; color: string; fontSize: number; at: MarkupPoint; text: string }

type HistoryStep = { kind: 'shape' } | { kind: 'crop'; previous: MarkupRect | null }

export type MarkupState = {
  tool: MarkupTool
  color: string
  shapes: MarkupShape[]
  crop: MarkupRect | null
  /** The drag in progress: a shape being drawn, or a crop being dragged out. */
  draft: MarkupDraft | null
  history: HistoryStep[]
}

/** A drag keeps where it started; the shape it will commit is derived from that and the finger. */
export type MarkupDraft =
  | { kind: 'pen'; color: string; width: number; points: MarkupPoint[] }
  | { kind: 'arrow' | 'rect'; color: string; width: number; from: MarkupPoint; to: MarkupPoint }
  | { kind: 'crop'; from: MarkupPoint; to: MarkupPoint }

/** The shape a draft would commit now, for drawing it under the finger. Null for a crop drag. */
export function draftShape(draft: MarkupDraft): MarkupShape | null {
  switch (draft.kind) {
    case 'pen':
      return draft
    case 'arrow':
      return {
        kind: 'arrow',
        color: draft.color,
        width: draft.width,
        from: draft.from,
        to: draft.to
      }
    case 'rect':
      return {
        kind: 'rect',
        color: draft.color,
        width: draft.width,
        rect: normalizeRect(draft.from, draft.to)
      }
    case 'crop':
      return null
  }
}

export type MarkupAction =
  | { type: 'set-tool'; tool: MarkupTool }
  | { type: 'set-color'; color: string }
  | { type: 'begin'; point: MarkupPoint; strokeWidth: number }
  /** A corner handle grabbed: the crop is redrawn from the fixed opposite corner to the finger. */
  | { type: 'begin-crop-resize'; anchor: MarkupPoint; point: MarkupPoint }
  | { type: 'extend'; point: MarkupPoint }
  | { type: 'end'; minSize: number }
  | { type: 'cancel-draft' }
  | { type: 'add-text'; at: MarkupPoint; text: string; fontSize: number }
  | { type: 'undo' }
  | { type: 'reset-crop' }

export const MARKUP_TEXT_MAX_LENGTH = 120

export function createMarkupState(): MarkupState {
  return {
    tool: 'arrow',
    color: MARKUP_COLORS[0],
    shapes: [],
    crop: null,
    draft: null,
    history: []
  }
}

export function markupReducer(state: MarkupState, action: MarkupAction): MarkupState {
  switch (action.type) {
    case 'set-tool':
      return { ...state, tool: action.tool, draft: null }
    case 'set-color':
      return { ...state, color: action.color }
    case 'begin':
      return { ...state, draft: beginDraft(state, action.point, action.strokeWidth) }
    case 'begin-crop-resize':
      return state.tool === 'crop' && state.crop
        ? { ...state, draft: { kind: 'crop', from: action.anchor, to: action.point } }
        : state
    case 'extend':
      return state.draft ? { ...state, draft: extendDraft(state.draft, action.point) } : state
    case 'end':
      return commitDraft(state, action.minSize)
    case 'cancel-draft':
      return { ...state, draft: null }
    case 'add-text': {
      const text = action.text.trim().slice(0, MARKUP_TEXT_MAX_LENGTH)
      if (!text) {
        return state
      }
      const shape: MarkupShape = {
        kind: 'text',
        color: state.color,
        fontSize: action.fontSize,
        at: action.at,
        text
      }
      return pushShape(state, shape)
    }
    case 'undo':
      return undo(state)
    case 'reset-crop':
      return state.crop
        ? {
            ...state,
            crop: null,
            history: [...state.history, { kind: 'crop', previous: state.crop }]
          }
        : state
  }
}

export function canUndoMarkup(state: MarkupState): boolean {
  return state.history.length > 0
}

/** Whether a flatten has anything to do beyond copying the capture. */
export function markupHasEdits(state: MarkupState): boolean {
  return state.shapes.length > 0 || state.crop !== null
}

function beginDraft(state: MarkupState, point: MarkupPoint, width: number): MarkupDraft | null {
  switch (state.tool) {
    case 'pen':
      return { kind: 'pen', color: state.color, width, points: [point] }
    case 'arrow':
    case 'rect':
      return { kind: state.tool, color: state.color, width, from: point, to: point }
    case 'crop':
      return { kind: 'crop', from: point, to: point }
    case 'text':
      // A text label is placed by a tap and typed in a prompt, not dragged.
      return null
  }
}

function extendDraft(draft: MarkupDraft, point: MarkupPoint): MarkupDraft {
  return draft.kind === 'pen'
    ? { ...draft, points: [...draft.points, point] }
    : { ...draft, to: point }
}

function commitDraft(state: MarkupState, minSize: number): MarkupState {
  const draft = state.draft
  if (!draft) {
    return state
  }
  const cleared = { ...state, draft: null }
  switch (draft.kind) {
    case 'pen':
      // One point is a dot and still a mark.
      return pushShape(cleared, draft)
    case 'arrow': {
      const shape = draftShape(draft)
      return !shape || Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) < minSize
        ? cleared
        : pushShape(cleared, shape)
    }
    case 'rect': {
      const shape = draftShape(draft)
      const rect = normalizeRect(draft.from, draft.to)
      return !shape || (rect.width < minSize && rect.height < minSize)
        ? cleared
        : pushShape(cleared, shape)
    }
    case 'crop': {
      const rect = normalizeRect(draft.from, draft.to)
      if (rect.width < MARKUP_MIN_CROP_PIXELS || rect.height < MARKUP_MIN_CROP_PIXELS) {
        return cleared
      }
      return {
        ...cleared,
        crop: rect,
        history: [...state.history, { kind: 'crop', previous: state.crop }]
      }
    }
  }
}

function pushShape(state: MarkupState, shape: MarkupShape): MarkupState {
  return {
    ...state,
    shapes: [...state.shapes, shape],
    history: [...state.history, { kind: 'shape' }]
  }
}

function undo(state: MarkupState): MarkupState {
  const last = state.history.at(-1)
  if (!last) {
    return state
  }
  const history = state.history.slice(0, -1)
  if (last.kind === 'shape') {
    return { ...state, draft: null, history, shapes: state.shapes.slice(0, -1) }
  }
  return { ...state, draft: null, history, crop: last.previous }
}
