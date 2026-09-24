import { Buffer } from 'buffer'

/** A JPEG head as Chromium's screencast writes one: SOI, a JFIF APP0, a DQT, then SOF0. */
export function jpegHeader(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]
  const dqt = [0xff, 0xdb, 0x00, 0x05, 0x00, 0x01, 0x02]
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    ...Array.from({ length: 9 }, () => 0x11)
  ]
  return new Uint8Array([0xff, 0xd8, ...app0, ...dqt, ...sof0, 0xff, 0xd9])
}

export function jpegDataUri(width: number, height: number): string {
  return `data:image/jpeg;base64,${Buffer.from(jpegHeader(width, height)).toString('base64')}`
}
