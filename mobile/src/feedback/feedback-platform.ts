import type { RefObject } from 'react'
import { PixelRatio, Platform, type View } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Directory, File as FsFile, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { captureRef } from 'react-native-view-shot'
import { FEEDBACK_CACHE_DIR_NAME, type FeedbackCaptureStore } from './feedback-capture'
import type { FeedbackImageSize } from './feedback-image-size'

/**
 * Every native module the feedback flow touches, in one place. The page bundle resolves
 * `feedback-platform.web.ts` instead, which answers "unsupported" so the Screenshot action never
 * renders there; none of these imports reach a browser.
 */
export const feedbackCaptureSupported = true

function cacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, FEEDBACK_CACHE_DIR_NAME)
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true })
  }
  return directory
}

/** Moves an ImageManipulator result (saved under a random cache name) into our directory. */
function adoptIntoCache(uri: string, name: string): string {
  const target = new FsFile(cacheDirectory(), name)
  if (target.exists) {
    target.delete()
  }
  const source = new FsFile(uri)
  source.move(target)
  return source.uri
}

async function manipulateAndSave(
  sourceUri: string,
  name: string,
  edit: (context: ReturnType<typeof ImageManipulator.manipulate>) => void,
  format: SaveFormat,
  compress?: number
): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(sourceUri)
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null
  try {
    edit(context)
    rendered = await context.renderAsync()
    const result = await rendered.saveAsync({ format, ...(compress ? { compress } : {}) })
    return { uri: adoptIntoCache(result.uri, name), width: result.width, height: result.height }
  } finally {
    rendered?.release()
    context.release()
  }
}

export const feedbackCaptureStore: FeedbackCaptureStore = {
  writeBase64: (name, base64) => {
    const file = new FsFile(cacheDirectory(), name)
    file.create({ overwrite: true })
    file.write(base64, { encoding: 'base64' })
    return file.uri
  },
  makeThumbnail: async (sourceUri, name, size) =>
    (
      await manipulateAndSave(
        sourceUri,
        name,
        (context) => {
          context.resize(size)
        },
        SaveFormat.JPEG,
        0.7
      )
    ).uri,
  list: () =>
    cacheDirectory()
      .list()
      .flatMap((entry) =>
        entry instanceof FsFile
          ? [{ name: entry.name, modifiedAt: entry.modificationTime ?? 0 }]
          : []
      ),
  remove: (name) => {
    new FsFile(cacheDirectory(), name).delete()
  }
}

export async function readFeedbackImageBase64(uri: string): Promise<string> {
  return new FsFile(uri).base64()
}

/**
 * A PNG of a mounted view, as base64. With a size, iOS draws the view into a context of that many
 * points at the screen scale, so `flattenCaptureSize` picks the size that lands on the image's own
 * pixel count.
 */
export async function captureFeedbackView(
  view: RefObject<View | null>,
  size?: FeedbackImageSize
): Promise<string> {
  return captureRef(view, {
    format: 'png',
    result: 'base64',
    ...(size ? { width: size.width, height: size.height } : {})
  })
}

export async function cropFeedbackImage(
  sourceUri: string,
  name: string,
  crop: { originX: number; originY: number; width: number; height: number }
): Promise<{ uri: string; width: number; height: number }> {
  return manipulateAndSave(
    sourceUri,
    name,
    (context) => {
      context.crop(crop)
    },
    SaveFormat.PNG
  )
}

export function feedbackPixelRatio(): number {
  return PixelRatio.get()
}

export type FeedbackDeviceInfo = { deviceModel: string; os: string; appVersion: string }

export function readFeedbackDeviceInfo(): FeedbackDeviceInfo {
  const version = Constants.expoConfig?.version ?? 'unknown'
  const build = Constants.platform?.ios?.buildNumber
  const name = Constants.expoConfig?.name ?? 'Orca Review'
  return {
    deviceModel: Device.modelName ?? Device.modelId ?? 'unknown device',
    os: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? String(Platform.Version)}`,
    appVersion: build ? `${name} ${version} (${build})` : `${name} ${version}`
  }
}
