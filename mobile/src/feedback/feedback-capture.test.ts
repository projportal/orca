import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import {
  computeThumbnailSize,
  feedbackCaptureFileName,
  makeFeedbackCaptureId,
  planFeedbackCacheCleanup,
  saveBrowserFrameCapture,
  type FeedbackCacheEntry,
  type FeedbackCaptureStore
} from './feedback-capture'
import { readImageSize, readImageSizeFromBase64, splitImageDataUri } from './feedback-image-size'
import { jpegHeader } from './feedback-fixtures.test-support'

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

function memoryStore(initial: FeedbackCacheEntry[] = []) {
  const files = new Map<string, { base64: string; modifiedAt: number }>()
  for (const entry of initial) {
    files.set(entry.name, { base64: '', modifiedAt: entry.modifiedAt })
  }
  const thumbnails: { source: string; name: string; width: number; height: number }[] = []
  let clock = 1_000
  const store: FeedbackCaptureStore = {
    writeBase64: (name, base64) => {
      files.set(name, { base64, modifiedAt: clock })
      return `file:///cache/orca-review-feedback/${name}`
    },
    makeThumbnail: async (source, name, size) => {
      thumbnails.push({ source, name, ...size })
      files.set(name, { base64: 'thumb', modifiedAt: clock })
      return `file:///cache/orca-review-feedback/${name}`
    },
    list: () => [...files].map(([name, file]) => ({ name, modifiedAt: file.modifiedAt })),
    remove: (name) => {
      files.delete(name)
    }
  }
  return {
    store,
    files,
    thumbnails,
    setClock: (value: number) => {
      clock = value
    }
  }
}

describe('image header size', () => {
  it('reads a JPEG size from its start-of-frame marker', () => {
    expect(readImageSize(jpegHeader(1206, 2148))).toEqual({ width: 1206, height: 2148 })
  })

  it('reads a PNG size from IHDR', () => {
    expect(readImageSize(pngHeader(800, 600))).toEqual({ width: 800, height: 600 })
  })

  it('answers null for bytes that are neither', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull()
    expect(readImageSize(new Uint8Array([0xff, 0xd8, 0x00]))).toBeNull()
  })

  it('reads the size through base64', () => {
    const base64 = Buffer.from(jpegHeader(390, 844)).toString('base64')
    expect(readImageSizeFromBase64(base64)).toEqual({ width: 390, height: 844 })
  })

  it('splits a frame data URI into format and base64', () => {
    expect(splitImageDataUri('data:image/jpeg;base64,AAAA')).toEqual({
      format: 'jpeg',
      base64: 'AAAA'
    })
    expect(splitImageDataUri('data:image/png;base64,BBBB').format).toBe('png')
    expect(() => splitImageDataUri('file:///x.jpg')).toThrow('not an image data URI')
  })
})

describe('frame to file', () => {
  it('writes the frame bytes untouched, with a thumbnail and the frame resolution', async () => {
    const base64 = Buffer.from(jpegHeader(1206, 2148)).toString('base64')
    const { store, files, thumbnails } = memoryStore()

    const capture = await saveBrowserFrameCapture(`data:image/jpeg;base64,${base64}`, store, {
      now: 5_000,
      id: 'fb-abc-000001'
    })

    expect(capture).toEqual({
      id: 'fb-abc-000001',
      createdAt: 5_000,
      source: 'browser-frame',
      format: 'jpeg',
      uri: 'file:///cache/orca-review-feedback/fb-abc-000001.jpg',
      width: 1206,
      height: 2148,
      thumbnailUri: 'file:///cache/orca-review-feedback/fb-abc-000001-thumb.jpg'
    })
    expect(files.get('fb-abc-000001.jpg')?.base64).toBe(base64)
    expect(thumbnails).toEqual([
      {
        source: capture.uri,
        name: 'fb-abc-000001-thumb.jpg',
        width: 135,
        height: 240
      }
    ])
  })

  it('refuses a frame whose size it cannot read', async () => {
    const { store, files } = memoryStore()
    await expect(
      saveBrowserFrameCapture('data:image/jpeg;base64,AAAAAAAA', store, { now: 1 })
    ).rejects.toThrow('screenshot size')
    expect(files.size).toBe(0)
  })

  it('names files by capture id and format', () => {
    expect(feedbackCaptureFileName('fb-1-a', 'png')).toBe('fb-1-a.png')
    expect(makeFeedbackCaptureId(36 ** 3, () => 0.5)).toBe('fb-1000-i00000')
  })
})

describe('thumbnail', () => {
  it('fits the long edge and keeps the aspect', () => {
    expect(computeThumbnailSize({ width: 2400, height: 1200 })).toEqual({ width: 240, height: 120 })
    expect(computeThumbnailSize({ width: 100, height: 50 })).toEqual({ width: 100, height: 50 })
    expect(computeThumbnailSize({ width: 5000, height: 1 }, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('cache cleanup', () => {
  const day = 24 * 60 * 60 * 1000

  it('removes every file of a capture past the age cap', () => {
    const entries = [
      { name: 'fb-old-aaaaaa.jpg', modifiedAt: 0 },
      { name: 'fb-old-aaaaaa-thumb.jpg', modifiedAt: 0 },
      { name: 'fb-new-bbbbbb.jpg', modifiedAt: 9 * day }
    ]
    expect(planFeedbackCacheCleanup(entries, { now: 10 * day, maxAgeMs: 3 * day })).toEqual([
      'fb-old-aaaaaa-thumb.jpg',
      'fb-old-aaaaaa.jpg'
    ])
  })

  it('keeps the newest captures up to the count cap and never a capture in use', () => {
    const entries = [1, 2, 3, 4].flatMap((n) => [
      { name: `fb-${n}-aaaaaa.jpg`, modifiedAt: n },
      { name: `fb-${n}-aaaaaa-flat.png`, modifiedAt: n }
    ])
    expect(
      planFeedbackCacheCleanup(entries, {
        now: 5,
        maxCaptures: 2,
        keepIds: new Set(['fb-1-aaaaaa'])
      })
    ).toEqual([
      'fb-2-aaaaaa-flat.png',
      'fb-2-aaaaaa.jpg',
      'fb-3-aaaaaa-flat.png',
      'fb-3-aaaaaa.jpg'
    ])
  })

  it('leaves files that are not captures alone', () => {
    expect(
      planFeedbackCacheCleanup([{ name: 'notes.txt', modifiedAt: 0 }], { now: 100 * day })
    ).toEqual([])
  })

  it('runs after each capture so the directory stays bounded', async () => {
    const base64 = Buffer.from(jpegHeader(10, 10)).toString('base64')
    const { store, files } = memoryStore([
      { name: 'fb-stale-aaaaaa.jpg', modifiedAt: 0 },
      { name: 'fb-stale-aaaaaa-thumb.jpg', modifiedAt: 0 }
    ])
    await saveBrowserFrameCapture(`data:image/jpeg;base64,${base64}`, store, {
      now: 10 * day,
      id: 'fb-fresh-bbbbbb'
    })
    expect([...files.keys()].sort()).toEqual(['fb-fresh-bbbbbb-thumb.jpg', 'fb-fresh-bbbbbb.jpg'])
  })
})
