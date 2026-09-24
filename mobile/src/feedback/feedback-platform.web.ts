import type { RefObject } from 'react'
import type { View } from 'react-native'
import type { FeedbackCaptureStore } from './feedback-capture'
import type { FeedbackImageSize } from './feedback-image-size'

/**
 * The page has no cache directory, no image manipulator and no view snapshot, so the feedback
 * flow is native-only: the Screenshot action reads this flag and does not render in the page.
 * Every function refuses rather than pretending, in case a future caller forgets the flag.
 */
export const feedbackCaptureSupported = false

function unsupported(): never {
  throw new Error('Screenshots are only available in the iPhone app')
}

export const feedbackCaptureStore: FeedbackCaptureStore = {
  writeBase64: unsupported,
  makeThumbnail: async () => unsupported(),
  list: () => [],
  remove: unsupported
}

export async function readFeedbackImageBase64(_uri: string): Promise<string> {
  return unsupported()
}

export async function captureFeedbackView(
  _view: RefObject<View | null>,
  _size?: FeedbackImageSize
): Promise<string> {
  return unsupported()
}

export async function cropFeedbackImage(
  _sourceUri: string,
  _name: string,
  _crop: { originX: number; originY: number; width: number; height: number }
): Promise<{ uri: string; width: number; height: number }> {
  return unsupported()
}

export function feedbackPixelRatio(): number {
  return 1
}

export type FeedbackDeviceInfo = { deviceModel: string; os: string; appVersion: string }

export function readFeedbackDeviceInfo(): FeedbackDeviceInfo {
  return { deviceModel: 'browser', os: 'web', appVersion: 'page' }
}
