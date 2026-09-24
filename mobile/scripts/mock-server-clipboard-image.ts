import type { RpcRequest, RpcResponse } from './mock-server-rpc-handlers'

// The chunked clipboard image upload, as src/main/runtime/rpc/methods/clipboard.ts answers it:
// a slot id from start, the running length from each append, and a host temp path from commit.
// Offsets must be contiguous and the committed length must match the one start announced, so a
// client that drops or reorders a chunk fails here the way it would against the desktop.

type MockUpload = { expected: number; base64: string; connectionId: unknown }

const uploads = new Map<string, MockUpload>()
const committed = new Map<string, string>()
let uploadSequence = 0

/** What a committed path holds, for tests that check the bytes arrived whole. */
export function readMockClipboardImage(path: string): string | undefined {
  return committed.get(path)
}

export function handleMockClipboardImageRequest(
  request: RpcRequest,
  respond: (response: RpcResponse) => void,
  success: (id: string, result: unknown) => RpcResponse,
  error: (id: string, code: string, message: string) => RpcResponse
): boolean {
  const params = request.params ?? {}
  switch (request.method) {
    case 'clipboard.startImageUpload': {
      const expected = params.expectedBase64Length
      if (typeof expected !== 'number' || expected <= 0) {
        respond(error(request.id, 'invalid_argument', 'Missing expected image length'))
        return true
      }
      uploadSequence += 1
      const uploadId = `mock-upload-${uploadSequence}`
      uploads.set(uploadId, { expected, base64: '', connectionId: params.connectionId })
      respond(success(request.id, { uploadId }))
      return true
    }
    case 'clipboard.appendImageUploadChunk': {
      const upload = uploads.get(String(params.uploadId))
      if (!upload || params.offset !== upload.base64.length) {
        respond(error(request.id, 'invalid_argument', 'Image upload chunk is out of order'))
        return true
      }
      upload.base64 += String(params.contentBase64 ?? '')
      respond(success(request.id, { receivedBase64Length: upload.base64.length }))
      return true
    }
    case 'clipboard.commitImageUpload': {
      const uploadId = String(params.uploadId)
      const upload = uploads.get(uploadId)
      uploads.delete(uploadId)
      if (!upload || upload.base64.length !== upload.expected) {
        respond(error(request.id, 'invalid_argument', 'Image upload is incomplete'))
        return true
      }
      const path = `/tmp/orca-clipboard/${uploadId}.png`
      committed.set(path, upload.base64)
      respond(success(request.id, path))
      return true
    }
    case 'clipboard.abortImageUpload':
      uploads.delete(String(params.uploadId))
      respond(success(request.id, { aborted: true }))
      return true
    default:
      return false
  }
}
