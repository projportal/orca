import { Buffer } from 'buffer'
import { describe, expect, it, vi } from 'vitest'
import type { FeedbackCapture } from './feedback-capture'
import { flattenMarkup, scaleCrop, type MarkupFlattenDeps } from './markup-flatten'
import { createMarkupState, markupReducer, type MarkupState } from './markup-model'

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

function pngBase64(width: number, height: number): string {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return Buffer.from(bytes).toString('base64')
}

function deps(snapshot = pngBase64(1206, 2148)) {
  const written: string[] = []
  const value: MarkupFlattenDeps = {
    captureCanvas: vi.fn(async () => snapshot),
    pixelRatio: 3,
    store: {
      writeBase64: (name) => {
        written.push(name)
        return `file:///c/${name}`
      }
    },
    crop: vi.fn(async (_uri: string, name: string, rect: { width: number; height: number }) => ({
      uri: `file:///c/${name}`,
      width: rect.width,
      height: rect.height
    }))
  }
  return { value, written }
}

function withArrowAndCrop(crop: boolean): MarkupState {
  let state = [
    { type: 'begin', point: { x: 100, y: 100 }, strokeWidth: 9 },
    { type: 'extend', point: { x: 600, y: 900 } },
    { type: 'end', minSize: 12 }
  ].reduce(
    (current, action) => markupReducer(current, action as Parameters<typeof markupReducer>[1]),
    createMarkupState()
  )
  if (crop) {
    state = [
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 50, y: 60 }, strokeWidth: 9 },
      { type: 'extend', point: { x: 850, y: 1260 } },
      { type: 'end', minSize: 12 }
    ].reduce(
      (current, action) => markupReducer(current, action as Parameters<typeof markupReducer>[1]),
      state
    )
  }
  return state
}

describe('flatten', () => {
  it('sends the untouched capture when nothing was drawn', async () => {
    const { value } = deps()
    expect(await flattenMarkup(CAPTURE, createMarkupState(), value)).toEqual({
      uri: CAPTURE.uri,
      width: 1206,
      height: 2148,
      markedUp: false
    })
    expect(value.captureCanvas).not.toHaveBeenCalled()
  })

  it('snapshots frame and drawing at the frame resolution', async () => {
    const { value, written } = deps()
    expect(await flattenMarkup(CAPTURE, withArrowAndCrop(false), value)).toEqual({
      uri: 'file:///c/fb-1-aaaaaa-flat.png',
      width: 1206,
      height: 2148,
      markedUp: true
    })
    // 1206x2148 pixels at 3x is 402x716 points.
    expect(value.captureCanvas).toHaveBeenCalledWith({ width: 402, height: 716 })
    expect(written).toEqual(['fb-1-aaaaaa-flat.png'])
  })

  it('crops the flattened image in its own pixels', async () => {
    const { value } = deps()
    const result = await flattenMarkup(CAPTURE, withArrowAndCrop(true), value)
    expect(value.crop).toHaveBeenCalledWith(
      'file:///c/fb-1-aaaaaa-flat.png',
      'fb-1-aaaaaa-crop.png',
      { originX: 50, originY: 60, width: 800, height: 1200 }
    )
    expect(result).toEqual({
      uri: 'file:///c/fb-1-aaaaaa-crop.png',
      width: 800,
      height: 1200,
      markedUp: true
    })
  })

  it('moves the crop onto a snapshot that came out a pixel off', async () => {
    const { value } = deps(pngBase64(603, 1074))
    await flattenMarkup(CAPTURE, withArrowAndCrop(true), value)
    expect(value.crop).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      originX: 25,
      originY: 30,
      width: 400,
      height: 600
    })
    expect(
      scaleCrop(
        { x: 10, y: 10, width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 20, height: 5 }
      )
    ).toEqual({
      x: 20,
      y: 5,
      width: 20,
      height: 5
    })
  })

  it('crops the capture directly when only a crop was made', async () => {
    const { value } = deps()
    const state = [
      { type: 'set-tool', tool: 'crop' },
      { type: 'begin', point: { x: 0, y: 0 }, strokeWidth: 3 },
      { type: 'extend', point: { x: 300, y: 300 } },
      { type: 'end', minSize: 12 }
    ].reduce(
      (current, action) => markupReducer(current, action as Parameters<typeof markupReducer>[1]),
      createMarkupState()
    )
    await flattenMarkup(CAPTURE, state, value)
    expect(value.captureCanvas).not.toHaveBeenCalled()
    expect(value.crop).toHaveBeenCalledWith(CAPTURE.uri, 'fb-1-aaaaaa-crop.png', {
      originX: 0,
      originY: 0,
      width: 300,
      height: 300
    })
  })
})
