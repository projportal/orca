import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))

vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  Crop: 'Crop',
  MessageSquarePlus: 'MessageSquarePlus',
  MoveUpRight: 'MoveUpRight',
  PenLine: 'PenLine',
  Pencil: 'Pencil',
  Square: 'Square',
  Trash2: 'Trash2',
  Type: 'Type',
  Undo2: 'Undo2'
}))

import type { FeedbackCapture } from './feedback-capture'
import { FEEDBACK_LAYOUT_WIDTH, FEEDBACK_MIN_TOUCH } from './feedback-touch-targets'
import type { MarkupTool } from './markup-model'
import { MobileFeedbackThumbnailChip } from './MobileFeedbackThumbnailChip'
import { MobileMarkupToolbar } from './MobileMarkupToolbar'

/**
 * Every feedback control's own frame is a full touch target: no `hitSlop`, which a short parent
 * row would clip. Sizes come from the rendered style tree, laid out as a flex row would lay it:
 * a Pressable is at least its width/minWidth, a row is its children plus gaps and padding.
 */
type Style = Record<string, unknown>

function flatStyle(style: unknown): Style {
  if (typeof style === 'function') {
    return flatStyle(Reflect.apply(style, undefined, [{ pressed: false }]))
  }
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flatStyle))
  }
  return typeof style === 'object' && style !== null
    ? Object.fromEntries(Object.entries(style))
    : {}
}

function num(style: Style, key: string): number {
  const value = style[key]
  return typeof value === 'number' ? value : 0
}

/** Host (native) children, looking through function components such as IconButton. */
function elementChildren(node: ReactTestInstance): ReactTestInstance[] {
  return node.children.flatMap((child) => {
    if (typeof child === 'string') {
      return []
    }
    return typeof child.type === 'string' ? [child] : elementChildren(child)
  })
}

function frameOf(node: ReactTestInstance): { width: number; height: number } {
  const style = flatStyle(node.props.style)
  return {
    width: Math.max(num(style, 'width'), num(style, 'minWidth'), contentWidth(node, style)),
    height: Math.max(num(style, 'height'), num(style, 'minHeight'))
  }
}

function contentWidth(node: ReactTestInstance, style: Style): number {
  const widths = elementChildren(node).map(layoutWidth)
  const inner =
    style.flexDirection === 'row'
      ? widths.reduce((sum, width) => sum + width, 0) +
        num(style, 'gap') * Math.max(0, widths.length - 1)
      : Math.max(0, ...widths)
  return inner + 2 * num(style, 'paddingHorizontal')
}

/** The width a node takes in its parent row; text and icons count only their margins. */
function layoutWidth(node: ReactTestInstance): number {
  const style = flatStyle(node.props.style)
  const margins = num(style, 'marginLeft') + num(style, 'marginRight')
  const type = String(node.type)
  if (!['View', 'Pressable', 'Image'].includes(type)) {
    return margins
  }
  return frameOf(node).width + margins
}

function pressables(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll((node) => String(node.type) === 'Pressable')
}

function expectFullTargets(targets: ReactTestInstance[]) {
  for (const target of targets) {
    const label = String(target.props.accessibilityLabel ?? 'unlabelled')
    expect(target.props.hitSlop, label).toBeUndefined()
    const frame = frameOf(target)
    expect(frame.width, `${label} width`).toBeGreaterThanOrEqual(FEEDBACK_MIN_TOUCH)
    expect(frame.height, `${label} height`).toBeGreaterThanOrEqual(FEEDBACK_MIN_TOUCH)
  }
}

let renderer: ReactTestRenderer | null = null

afterEach(() => {
  act(() => renderer?.unmount())
  renderer = null
})

function mount(element: ReturnType<typeof createElement>): ReactTestInstance {
  act(() => {
    renderer = create(element)
  })
  const [top] = renderer ? elementChildren(renderer.root) : []
  if (!top) {
    throw new Error('nothing rendered')
  }
  return top
}

function renderToolbar(tool: MarkupTool, hasCrop: boolean): ReactTestInstance {
  return mount(
    createElement(MobileMarkupToolbar, {
      tool,
      color: '#ff3b30',
      canUndo: true,
      hasCrop,
      busy: false,
      onTool: () => {},
      onColor: () => {},
      onUndo: () => {},
      onResetCrop: () => {},
      onCancel: () => {},
      onDone: () => {}
    })
  )
}

function contentWidthOf(bar: ReactTestInstance): number {
  return FEEDBACK_LAYOUT_WIDTH - 2 * num(flatStyle(bar.props.style), 'paddingHorizontal')
}

const TOOLBAR_STATES: { tool: MarkupTool; hasCrop: boolean; targets: number }[] = [
  // Cancel, Undo, Done, 5 tools, 6 swatches.
  { tool: 'arrow', hasCrop: false, targets: 14 },
  // Swatches step aside while cropping; no crop yet, so no third row.
  { tool: 'crop', hasCrop: false, targets: 8 },
  { tool: 'crop', hasCrop: true, targets: 9 },
  // Swatches and Reset crop share the third row: the widest one.
  { tool: 'pen', hasCrop: true, targets: 15 }
]

describe('markup toolbar touch targets', () => {
  it.each(TOOLBAR_STATES)(
    'gives every control a 44 x 44 frame of its own ($tool, crop: $hasCrop)',
    ({ tool, hasCrop, targets }) => {
      const controls = pressables(renderToolbar(tool, hasCrop))
      expect(controls).toHaveLength(targets)
      expectFullTargets(controls)
    }
  )

  it.each(TOOLBAR_STATES)(
    'lays each row at least 44 tall and within an iPhone 17 Pro width ($tool, crop: $hasCrop)',
    ({ tool, hasCrop }) => {
      const bar = renderToolbar(tool, hasCrop)
      expect(num(flatStyle(bar.props.style), 'gap')).toBeGreaterThanOrEqual(0)
      for (const row of elementChildren(bar)) {
        expect(num(flatStyle(row.props.style), 'minHeight')).toBeGreaterThanOrEqual(
          FEEDBACK_MIN_TOUCH
        )
        // Frames sit side by side with non-negative gaps, so fitting the width means none overlap.
        expect(frameOf(row).width).toBeLessThanOrEqual(contentWidthOf(bar))
        for (const group of elementChildren(row)) {
          expect(num(flatStyle(group.props.style), 'gap')).toBeGreaterThanOrEqual(0)
        }
      }
    }
  )

  it('leaves the tool hint room to read beside the five tools', () => {
    const bar = renderToolbar('crop', false)
    const [tools, hint] = elementChildren(elementChildren(bar)[1])
    expect(frameOf(tools).width).toBe(5 * FEEDBACK_MIN_TOUCH)
    expect(contentWidthOf(bar) - frameOf(tools).width - layoutWidth(hint)).toBeGreaterThanOrEqual(
      140
    )
  })
})

const CAPTURE: FeedbackCapture = {
  id: 'fb-1-aaaaaa',
  createdAt: 1,
  source: 'browser-frame',
  format: 'jpeg',
  uri: 'file:///c/fb-1-aaaaaa.jpg',
  width: 1206,
  height: 2148,
  thumbnailUri: 'file:///c/fb-1-aaaaaa-thumb.jpg'
}

describe('thumbnail chip touch targets', () => {
  it('makes the thumbnail and its three actions full targets, stacked with a gap', () => {
    const chip = mount(
      createElement(MobileFeedbackThumbnailChip, {
        capture: CAPTURE,
        onMarkUp: () => {},
        onAddFeedback: () => {},
        onDiscard: () => {}
      })
    )
    const controls = pressables(chip)
    expect(controls.map((node) => node.props.accessibilityLabel)).toEqual([
      'Mark up screenshot',
      'Mark up',
      'Add feedback',
      'Discard screenshot'
    ])
    expectFullTargets(controls)
    const actions = elementChildren(chip)[1]
    expect(elementChildren(actions)).toEqual(controls.slice(1))
    expect(num(flatStyle(actions.props.style), 'gap')).toBeGreaterThan(0)
  })
})
