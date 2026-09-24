import { Buffer } from 'buffer'

export type FeedbackImageFormat = 'jpeg' | 'png'
export type FeedbackImageSize = { width: number; height: number }

const DATA_URI_RE = /^data:image\/(jpeg|jpg|png);base64,/i

/** A screencast frame as the pane caches it: a base64 data URI of the JPEG or PNG bytes. */
export function splitImageDataUri(uri: string): { format: FeedbackImageFormat; base64: string } {
  const match = DATA_URI_RE.exec(uri)
  if (!match) {
    throw new Error('Screenshot source is not an image data URI')
  }
  const kind = match[1].toLowerCase()
  return { format: kind === 'png' ? 'png' : 'jpeg', base64: uri.slice(match[0].length) }
}

/**
 * Pixel size read from the image header, so a frozen frame knows its resolution without a
 * decode. Screencast metadata carries the page's CSS viewport, not the JPEG's pixels.
 */
export function readImageSize(bytes: Uint8Array): FeedbackImageSize | null {
  return readPngSize(bytes) ?? readJpegSize(bytes)
}

// Only the header is needed: 64 KiB of base64 covers any JPEG's SOF marker after EXIF/ICC.
const HEADER_BASE64_CHARS = 64 * 1024

export function readImageSizeFromBase64(base64: string): FeedbackImageSize | null {
  const head = base64.slice(0, HEADER_BASE64_CHARS - (HEADER_BASE64_CHARS % 4))
  return readImageSize(new Uint8Array(Buffer.from(head, 'base64')))
}

function readPngSize(bytes: Uint8Array): FeedbackImageSize | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) {
    return null
  }
  const width = readUint32(bytes, 16)
  const height = readUint32(bytes, 20)
  return width > 0 && height > 0 ? { width, height } : null
}

function readJpegSize(bytes: Uint8Array): FeedbackImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null
    }
    const marker = bytes[offset + 1]
    // Fill bytes and standalone markers carry no length.
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (isStartOfFrame(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      return width > 0 && height > 0 ? { width, height } : null
    }
    if (length < 2) {
      return null
    }
    offset += 2 + length
  }
  return null
}

// SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}
