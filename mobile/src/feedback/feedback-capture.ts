import {
  readImageSizeFromBase64,
  splitImageDataUri,
  type FeedbackImageFormat,
  type FeedbackImageSize
} from './feedback-image-size'

/** One screenshot on the phone: the image file, its thumbnail, and what it was taken of. */
export type FeedbackCapture = {
  id: string
  createdAt: number
  source: 'browser-frame' | 'html-preview'
  format: FeedbackImageFormat
  uri: string
  width: number
  height: number
  thumbnailUri: string
}

/** A file in the feedback cache directory, as the store lists it. */
export type FeedbackCacheEntry = { name: string; modifiedAt: number }

/**
 * The file-system side of a capture, injected so this module stays free of Expo imports. The native
 * implementation is `feedback-platform.ts`; tests pass an in-memory one.
 */
export type FeedbackCaptureStore = {
  writeBase64: (name: string, base64: string) => string
  makeThumbnail: (sourceUri: string, name: string, size: FeedbackImageSize) => Promise<string>
  list: () => FeedbackCacheEntry[]
  remove: (name: string) => void
}

export const FEEDBACK_CACHE_DIR_NAME = 'orca-review-feedback'
export const FEEDBACK_THUMBNAIL_MAX_EDGE = 240
export const FEEDBACK_CACHE_MAX_CAPTURES = 12
export const FEEDBACK_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

const EXTENSION: Record<FeedbackImageFormat, string> = { jpeg: 'jpg', png: 'png' }
const CAPTURE_ID_RE = /^(fb-[0-9a-z]+-[0-9a-z]+)/

export function makeFeedbackCaptureId(now: number, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
  return `fb-${now.toString(36)}-${suffix}`
}

export function feedbackCaptureFileName(id: string, format: FeedbackImageFormat): string {
  return `${id}.${EXTENSION[format]}`
}

export function feedbackThumbnailFileName(id: string): string {
  return `${id}-thumb.jpg`
}

/** A derived image of the same capture (flattened markup, crop), kept under the capture's id. */
export function feedbackDerivedFileName(id: string, label: string, format: FeedbackImageFormat) {
  return `${id}-${label}.${EXTENSION[format]}`
}

export function computeThumbnailSize(
  size: FeedbackImageSize,
  maxEdge: number = FEEDBACK_THUMBNAIL_MAX_EDGE
): FeedbackImageSize {
  const longest = Math.max(size.width, size.height)
  if (longest <= maxEdge) {
    return { width: size.width, height: size.height }
  }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  }
}

/**
 * Which cache files to delete: everything of a capture older than the age cap, then the oldest
 * captures past the count cap. A capture still in use (open in markup, the composer or a pending
 * send) is never removed. Files that are not ours are left alone.
 */
export function planFeedbackCacheCleanup(
  entries: readonly FeedbackCacheEntry[],
  options: {
    now: number
    keepIds?: ReadonlySet<string>
    maxCaptures?: number
    maxAgeMs?: number
  }
): string[] {
  const maxCaptures = options.maxCaptures ?? FEEDBACK_CACHE_MAX_CAPTURES
  const maxAgeMs = options.maxAgeMs ?? FEEDBACK_CACHE_MAX_AGE_MS
  const byId = new Map<string, { newest: number; names: string[] }>()
  for (const entry of entries) {
    const id = CAPTURE_ID_RE.exec(entry.name)?.[1]
    if (!id) {
      continue
    }
    const group = byId.get(id) ?? { newest: 0, names: [] }
    group.newest = Math.max(group.newest, entry.modifiedAt)
    group.names.push(entry.name)
    byId.set(id, group)
  }
  const doomed = new Set<string>()
  const survivors: { id: string; newest: number }[] = []
  for (const [id, group] of byId) {
    if (options.keepIds?.has(id)) {
      continue
    }
    if (options.now - group.newest > maxAgeMs) {
      doomed.add(id)
    } else {
      survivors.push({ id, newest: group.newest })
    }
  }
  const keptCount = [...byId.keys()].filter((id) => options.keepIds?.has(id)).length
  const room = Math.max(0, maxCaptures - keptCount)
  survivors.sort((a, b) => b.newest - a.newest)
  for (const extra of survivors.slice(room)) {
    doomed.add(extra.id)
  }
  return [...byId.entries()]
    .filter(([id]) => doomed.has(id))
    .flatMap(([, group]) => group.names)
    .sort()
}

export function cleanFeedbackCache(
  store: Pick<FeedbackCaptureStore, 'list' | 'remove'>,
  options: Parameters<typeof planFeedbackCacheCleanup>[1]
): string[] {
  const doomed = planFeedbackCacheCleanup(store.list(), options)
  for (const name of doomed) {
    try {
      store.remove(name)
    } catch {
      // Best effort: the OS reclaims the cache directory regardless.
    }
  }
  return doomed
}

/**
 * Freezes the frame on screen into a file. The pane already holds the frame's bytes as the data
 * URI it painted, so nothing is fetched from the desktop: the base64 is written as-is.
 */
export async function saveBrowserFrameCapture(
  frameUri: string,
  store: FeedbackCaptureStore,
  options: { now: number; id?: string; keepIds?: ReadonlySet<string> }
): Promise<FeedbackCapture> {
  const { format, base64 } = splitImageDataUri(frameUri)
  const size = readImageSizeFromBase64(base64)
  if (!size) {
    throw new Error('Could not read the screenshot size')
  }
  return saveCaptureBase64({ base64, format, size, source: 'browser-frame' }, store, options)
}

export async function saveCaptureBase64(
  image: {
    base64: string
    format: FeedbackImageFormat
    size: FeedbackImageSize
    source: FeedbackCapture['source']
  },
  store: FeedbackCaptureStore,
  options: { now: number; id?: string; keepIds?: ReadonlySet<string> }
): Promise<FeedbackCapture> {
  const id = options.id ?? makeFeedbackCaptureId(options.now)
  const uri = store.writeBase64(feedbackCaptureFileName(id, image.format), image.base64)
  const thumbnailUri = await store.makeThumbnail(
    uri,
    feedbackThumbnailFileName(id),
    computeThumbnailSize(image.size)
  )
  cleanFeedbackCache(store, {
    now: options.now,
    keepIds: new Set([...(options.keepIds ?? []), id])
  })
  return {
    id,
    createdAt: options.now,
    source: image.source,
    format: image.format,
    uri,
    width: image.size.width,
    height: image.size.height,
    thumbnailUri
  }
}
