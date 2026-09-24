import {
  createMarkupState,
  markupReducer,
  type MarkupAction,
  type MarkupState
} from '../markup-model'

export type FeedbackDemoStep =
  | 'toolbar'
  | 'hint'
  | 'captured'
  | 'markup'
  | 'markup-label'
  | 'crop'
  | 'composer'
  | 'composer-details'
  | 'viewer'
  | 'picker'
  | 'delivered'
  | 'html'

export const FEEDBACK_DEMO_STEPS: readonly FeedbackDemoStep[] = [
  'toolbar',
  'hint',
  'captured',
  'markup',
  'markup-label',
  'crop',
  'composer',
  'composer-details',
  'viewer',
  'picker',
  'delivered',
  'html'
]

/** Steps that press Done on the crop step's drawing and continue into the composer. */
export function feedbackDemoStepNeedsComposer(step: FeedbackDemoStep): boolean {
  return (
    step === 'composer' ||
    step === 'composer-details' ||
    step === 'viewer' ||
    step === 'picker' ||
    step === 'delivered'
  )
}

export function parseFeedbackDemoStep(value: unknown): FeedbackDemoStep {
  return FEEDBACK_DEMO_STEPS.find((step) => step === value) ?? 'toolbar'
}

/** Strokes as the markup overlay stores them at the sample frame's fit (1 pt = 3 px). */
const STROKE = 9
const DRAG_FLOOR = 18

function drag(from: { x: number; y: number }, to: { x: number; y: number }): MarkupAction[] {
  return [
    { type: 'begin', point: from, strokeWidth: STROKE },
    { type: 'extend', point: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } },
    { type: 'extend', point: to },
    { type: 'end', minSize: DRAG_FLOOR }
  ]
}

/**
 * The drawing each step opens markup with, built through the same reducer a finger drives: a red
 * box around the price row the CTA covers, and an arrow at the hidden "/ month". Coordinates are
 * pixels of the 1206x1680 sample frame.
 */
export function feedbackDemoMarkupSeed(step: FeedbackDemoStep): MarkupState {
  const actions: MarkupAction[] = [
    { type: 'set-tool', tool: 'rect' },
    ...drag({ x: 96, y: 860 }, { x: 1110, y: 1060 }),
    { type: 'set-tool', tool: 'arrow' },
    ...drag({ x: 560, y: 1250 }, { x: 420, y: 1010 })
  ]
  const cropped = step === 'crop' || feedbackDemoStepNeedsComposer(step)
  if (step === 'markup-label' || cropped) {
    actions.push(
      { type: 'set-color', color: '#ffcc00' },
      { type: 'set-tool', tool: 'text' },
      { type: 'add-text', at: { x: 470, y: 1300 }, text: 'CTA hides "/ month"', fontSize: 48 }
    )
  }
  // The composer steps finish this same cropped drawing, so crop → Done → composer is one run.
  if (cropped) {
    actions.push(
      { type: 'set-tool', tool: 'crop' },
      ...drag({ x: 48, y: 720 }, { x: 1158, y: 1580 })
    )
  }
  return actions.reduce(markupReducer, createMarkupState())
}

export const FEEDBACK_DEMO_COMMENT =
  'The "Start free trial" button sits on top of the price row and hides "/ month per seat". ' +
  'Move the CTA below the price (full width on mobile) and keep 16px between them.'
