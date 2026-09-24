import {
  feedbackDerivedFileName,
  type FeedbackCapture,
  type FeedbackCaptureStore
} from './feedback-capture'
import { readImageSizeFromBase64, type FeedbackImageSize } from './feedback-image-size'
import { cropRectToPixels, flattenCaptureSize } from './markup-geometry'
import { markupHasEdits, type MarkupState } from './markup-model'

/** The image the composer sends: the flattened markup, or the untouched capture. */
export type FeedbackComposedImage = {
  uri: string
  width: number
  height: number
  markedUp: boolean
}

export type MarkupFlattenDeps = {
  /** Snapshot of the canvas view (frame image + drawing), asked for at `size` points. */
  captureCanvas: (size: FeedbackImageSize) => Promise<string>
  pixelRatio: number
  store: Pick<FeedbackCaptureStore, 'writeBase64'>
  crop: (
    sourceUri: string,
    name: string,
    rect: { originX: number; originY: number; width: number; height: number }
  ) => Promise<{ uri: string; width: number; height: number }>
}

/**
 * One image out of frame + drawing, at the frame's own resolution, then cropped. With nothing
 * drawn and no crop the capture itself is sent untouched (no re-encode of the JPEG).
 */
export async function flattenMarkup(
  capture: FeedbackCapture,
  state: MarkupState,
  deps: MarkupFlattenDeps
): Promise<FeedbackComposedImage> {
  if (!markupHasEdits(state)) {
    return { uri: capture.uri, width: capture.width, height: capture.height, markedUp: false }
  }
  const frame = { width: capture.width, height: capture.height }
  let uri = capture.uri
  let size: FeedbackImageSize = frame
  if (state.shapes.length > 0) {
    const base64 = await deps.captureCanvas(flattenCaptureSize(frame, deps.pixelRatio))
    // The snapshot's own header is the truth: a rounding in the point size can move it a pixel.
    size = readImageSizeFromBase64(base64) ?? frame
    uri = deps.store.writeBase64(feedbackDerivedFileName(capture.id, 'flat', 'png'), base64)
  }
  const cropPixels = state.crop ? cropRectToPixels(scaleCrop(state.crop, frame, size), size) : null
  if (cropPixels) {
    const cropped = await deps.crop(
      uri,
      feedbackDerivedFileName(capture.id, 'crop', 'png'),
      cropPixels
    )
    return { uri: cropped.uri, width: cropped.width, height: cropped.height, markedUp: true }
  }
  return { uri, width: size.width, height: size.height, markedUp: state.shapes.length > 0 }
}

/** A crop drawn in frame pixels, moved onto an image that may be a pixel off in size. */
export function scaleCrop(
  crop: NonNullable<MarkupState['crop']>,
  from: FeedbackImageSize,
  to: FeedbackImageSize
): NonNullable<MarkupState['crop']> {
  const sx = to.width / from.width
  const sy = to.height / from.height
  return { x: crop.x * sx, y: crop.y * sy, width: crop.width * sx, height: crop.height * sy }
}
