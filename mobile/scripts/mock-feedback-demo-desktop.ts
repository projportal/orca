import { Buffer } from 'buffer'
import { handleMockClipboardImageRequest } from './mock-server-clipboard-image'
import {
  BrowserScreencastOpcode,
  type BrowserScreencastFrame
} from '../src/transport/browser-screencast-protocol'
import type { RpcClient } from '../src/transport/rpc-client'
import type { RpcResponse } from '../src/transport/types'
import {
  SAMPLE_FRAME_HEIGHT,
  SAMPLE_FRAME_JPEG_BASE64,
  SAMPLE_FRAME_WIDTH
} from '../src/feedback/demo/sample-frame.generated'

/** Every request the demo desktop answered, newest last; the demo screen shows the tail. */
export type DemoRpcLogEntry = { method: string; summary: string }

const META = { runtimeId: 'feedback-demo' }

/**
 * A stand-in desktop for the Orca Review feedback demo route, in-process: it streams one sample
 * screencast frame as binary and answers the calls the feedback flow makes (the chunked clipboard
 * upload through the mock server's own handler, session.tabs.list/createTerminal, terminal.send).
 * Nothing leaves the phone. It lives beside the mock server rather than under src/ because it
 * fakes the desktop's side of the raw request port, which no app module may do; the demo entry is
 * its only importer, and metro drops that entry from every bundle not built for the demo.
 */
export function createFeedbackDemoRpcClient(log: (entry: DemoRpcLogEntry) => void): RpcClient {
  let terminals = 0
  const answer = (id: string, method: string, params: Record<string, unknown>): RpcResponse => {
    const holder: { response: RpcResponse | null } = { response: null }
    const request = { id, method, params }
    const clipboard = handleMockClipboardImageRequest(
      request,
      (response) => {
        holder.response = response.ok
          ? { id, ok: true, result: response.result, _meta: META }
          : { id, ok: false, error: response.error ?? { code: 'x', message: '' }, _meta: META }
      },
      (replyId, result) => ({ id: replyId, ok: true, result, _meta: META }),
      (replyId, code, message) => ({
        id: replyId,
        ok: false,
        error: { code, message },
        _meta: META
      })
    )
    if (clipboard && holder.response) {
      return holder.response
    }
    switch (method) {
      case 'session.tabs.list':
        return ok(id, {
          tabs: [
            {
              type: 'terminal',
              id: 'demo-tab-1',
              title: 'claude',
              terminal: 'term-demo-1',
              launchAgent: 'claude'
            },
            {
              type: 'terminal',
              id: 'demo-tab-2',
              title: 'codex',
              terminal: 'term-demo-2',
              launchAgent: 'codex'
            }
          ]
        })
      case 'session.tabs.createTerminal':
        terminals += 1
        return ok(id, {
          tab: {
            type: 'terminal',
            id: `demo-new-${terminals}`,
            title: 'claude',
            terminal: `term-new-${terminals}`,
            launchAgent: 'claude'
          }
        })
      case 'terminal.send':
        return ok(id, { send: { handle: params.terminal, accepted: true } })
      default:
        return { id, ok: false, error: { code: 'method_not_found', message: method }, _meta: META }
    }
  }
  let sequence = 0
  return {
    sendRequest: async (method, params) => {
      sequence += 1
      const record = (params ?? {}) as Record<string, unknown>
      log({ method, summary: summarize(method, record) })
      return answer(`demo-${sequence}`, method, record)
    },
    subscribe: (method, _params, _onData, options) => {
      if (method !== 'browser.screencast') {
        return () => {}
      }
      const timer = setTimeout(() => {
        options?.onBinaryFrame?.(sampleFrame())
      }, 250)
      return () => clearTimeout(timer)
    },
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => Date.now(),
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
}

function ok(id: string, result: unknown): RpcResponse {
  return { id, ok: true, result, _meta: META }
}

function sampleFrame(): BrowserScreencastFrame {
  return {
    opcode: BrowserScreencastOpcode.Frame,
    seq: 1,
    format: 'jpeg',
    metadata: {
      deviceWidth: SAMPLE_FRAME_WIDTH / 3,
      deviceHeight: SAMPLE_FRAME_HEIGHT / 3,
      pageScaleFactor: 1
    },
    image: new Uint8Array(Buffer.from(SAMPLE_FRAME_JPEG_BASE64, 'base64'))
  }
}

function summarize(method: string, params: Record<string, unknown>): string {
  if (method === 'clipboard.appendImageUploadChunk') {
    return `offset ${String(params.offset)}, ${String(params.contentBase64 ?? '').length} chars`
  }
  if (method === 'clipboard.startImageUpload') {
    return `${String(params.expectedBase64Length)} base64 chars`
  }
  if (method === 'terminal.send') {
    return params.enter === true
      ? `${String(params.terminal)} ⏎`
      : `${String(params.terminal)} paste`
  }
  return ''
}
