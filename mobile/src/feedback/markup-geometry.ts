export type MarkupPoint = { x: number; y: number }
export type MarkupRect = { x: number; y: number; width: number; height: number }
export type MarkupSize = { width: number; height: number }

/** Where an image sits when fitted ("contain") in a box, and how many points one image pixel is. */
export type MarkupFit = MarkupRect & { scale: number }

/** On-screen stroke width in points; shapes store it in image pixels so the flatten matches. */
export const MARKUP_STROKE_POINTS = 3
export const MARKUP_TEXT_POINTS = 16
export const MARKUP_MIN_SHAPE_POINTS = 6
export const MARKUP_MIN_CROP_PIXELS = 16

export function computeContainFit(container: MarkupSize, image: MarkupSize): MarkupFit | null {
  if (container.width <= 0 || container.height <= 0 || image.width <= 0 || image.height <= 0) {
    return null
  }
  const scale = Math.min(container.width / image.width, container.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
    scale
  }
}

/** A touch in the canvas view's own coordinates, as a point on the image, clamped to its edges. */
export function canvasToImagePoint(
  point: MarkupPoint,
  fit: MarkupFit,
  image: MarkupSize
): MarkupPoint {
  return {
    x: clamp(point.x / fit.scale, 0, image.width),
    y: clamp(point.y / fit.scale, 0, image.height)
  }
}

export function pointsToImagePixels(points: number, fit: MarkupFit): number {
  return points / fit.scale
}

export function normalizeRect(a: MarkupPoint, b: MarkupPoint): MarkupRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

export function clampRect(rect: MarkupRect, bounds: MarkupSize): MarkupRect {
  const x = clamp(rect.x, 0, bounds.width)
  const y = clamp(rect.y, 0, bounds.height)
  return {
    x,
    y,
    width: clamp(rect.x + rect.width, x, bounds.width) - x,
    height: clamp(rect.y + rect.height, y, bounds.height) - y
  }
}

/** The two barb ends of an arrow head at `to`, each `length` back from the tip at ±`spread`. */
export function arrowHeadPoints(
  from: MarkupPoint,
  to: MarkupPoint,
  length: number,
  spread: number = Math.PI / 7
): [MarkupPoint, MarkupPoint] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const barb = (offset: number): MarkupPoint => ({
    x: to.x - length * Math.cos(angle + offset),
    y: to.y - length * Math.sin(angle + offset)
  })
  return [barb(spread), barb(-spread)]
}

export function arrowHeadLength(from: MarkupPoint, to: MarkupPoint, strokeWidth: number): number {
  const shaft = Math.hypot(to.x - from.x, to.y - from.y)
  return Math.min(shaft * 0.45, Math.max(strokeWidth * 4, 10))
}

export function polylinePathData(points: readonly MarkupPoint[]): string {
  if (points.length === 0) {
    return ''
  }
  const [first, ...rest] = points
  const head = `M${round2(first.x)} ${round2(first.y)}`
  if (rest.length === 0) {
    // A tap draws a dot: a zero-length segment with round caps.
    return `${head} L${round2(first.x)} ${round2(first.y)}`
  }
  return `${head} ${rest.map((point) => `L${round2(point.x)} ${round2(point.y)}`).join(' ')}`
}

/** A rough label width for the text chip's backing box; the SVG text itself is not measured. */
export function estimateLabelWidth(text: string, fontSize: number): number {
  return Math.max(fontSize, text.length * fontSize * 0.58) + fontSize * 0.8
}

/**
 * The size view-shot must be asked for so the flattened PNG comes out at the image's own pixel
 * size. iOS draws the view into a context of that many points at the screen scale.
 */
export function flattenCaptureSize(image: MarkupSize, pixelRatio: number): MarkupSize {
  const ratio = pixelRatio > 0 ? pixelRatio : 1
  return { width: image.width / ratio, height: image.height / ratio }
}

/** A crop rectangle as whole image pixels, inside the image and not smaller than the floor. */
export function cropRectToPixels(
  crop: MarkupRect,
  image: MarkupSize
): { originX: number; originY: number; width: number; height: number } | null {
  const clamped = clampRect(crop, image)
  const originX = Math.floor(clamped.x)
  const originY = Math.floor(clamped.y)
  const width = Math.min(image.width - originX, Math.round(clamped.width))
  const height = Math.min(image.height - originY, Math.round(clamped.height))
  if (width < MARKUP_MIN_CROP_PIXELS || height < MARKUP_MIN_CROP_PIXELS) {
    return null
  }
  if (originX === 0 && originY === 0 && width === image.width && height === image.height) {
    return null
  }
  return { originX, originY, width, height }
}

/** Crop corner handles: drawn this big, grabbed within a square this big (both in points). */
export const MARKUP_CROP_HANDLE_POINTS = 24
export const MARKUP_CROP_HANDLE_HIT_POINTS = 44

export type CropCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export const CROP_CORNERS: readonly CropCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
]

export function cropCornerPoints(crop: MarkupRect): Record<CropCorner, MarkupPoint> {
  const right = crop.x + crop.width
  const bottom = crop.y + crop.height
  return {
    'top-left': { x: crop.x, y: crop.y },
    'top-right': { x: right, y: crop.y },
    'bottom-left': { x: crop.x, y: bottom },
    'bottom-right': { x: right, y: bottom }
  }
}

const OPPOSITE: Record<CropCorner, CropCorner> = {
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left'
}

/** The corner a touch (image pixels) grabs, nearest first, or null outside every handle's hit square. */
export function cropCornerAt(
  point: MarkupPoint,
  crop: MarkupRect,
  fit: Pick<MarkupFit, 'scale'>,
  hitPoints: number = MARKUP_CROP_HANDLE_HIT_POINTS
): CropCorner | null {
  const reach = hitPoints / 2 / fit.scale
  const corners = cropCornerPoints(crop)
  let best: { corner: CropCorner; distance: number } | null = null
  for (const corner of CROP_CORNERS) {
    const at = corners[corner]
    const dx = Math.abs(point.x - at.x)
    const dy = Math.abs(point.y - at.y)
    if (dx > reach || dy > reach) {
      continue
    }
    const distance = Math.hypot(dx, dy)
    if (!best || distance < best.distance) {
      best = { corner, distance }
    }
  }
  return best?.corner ?? null
}

/** Where a corner drag is anchored: the corner diagonally across, which stays put. */
export function oppositeCropCorner(crop: MarkupRect, corner: CropCorner): MarkupPoint {
  return cropCornerPoints(crop)[OPPOSITE[corner]]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
