import { Buffer } from 'buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSocket } from 'ws'
import { readMockClipboardImage } from '../../scripts/mock-server-clipboard-image'
import { handleRequest, type RpcResponse } from '../../scripts/mock-server-rpc-handlers'
import { MOBILE_CLIPBOARD_IMAGE_UPLOAD_CHUNK_BASE64_CHARS } from '../session/mobile-clipboard-image'
import type { RpcResponse as ClientRpcResponse } from '../transport/types'
import {
  buildFeedbackClipboardText,
  buildFeedbackTerminalText,
  createFeedbackTerminal,
  deliverFeedbackToTerminal,
  feedbackSubmitDelayMs,
  listFeedbackTerminals,
  type FeedbackRpcSender
} from './feedback-send'
import {
  FEEDBACK_COMMENT_MAX_CHARS,
  clampFeedbackComment,
  feedbackPageHeading,
  formatFeedbackMarkdown,
  type FeedbackHeader
} from './feedback-message'

const HEADER: FeedbackHeader = {
  pageUrl: 'http://localhost:5173/pricing?plan=pro',
  browserTabId: 'page-7',
  viewport: { width: 402, height: 716 },
  viewMode: 'mobile',
  deviceModel: 'iPhone 17 Pro',
  os: 'iOS 26.3',
  appVersion: 'Orca Review 0.1.0 (1)'
}

/** The mock server's wire envelope as the client's discriminated reply type. */
function toClientResponse(response: RpcResponse): ClientRpcResponse {
  return response.ok
    ? { id: response.id, ok: true, result: response.result, _meta: response._meta }
    : {
        id: response.id,
        ok: false,
        error: response.error ?? { code: 'unknown', message: '' },
        _meta: response._meta
      }
}

/** Request params as the handlers' record shape; anything but an object is no params. */
function paramsRecord(params: unknown): Record<string, unknown> {
  return typeof params === 'object' && params !== null
    ? Object.fromEntries(Object.entries(params))
    : {}
}

/** An RpcClient that answers from the repo's mock server handlers, recording every call. */
function mockServerClient(): FeedbackRpcSender & {
  calls: { method: string; params: Record<string, unknown> }[]
} {
  const calls: { method: string; params: Record<string, unknown> }[] = []
  let sequence = 0
  return {
    calls,
    sendRequest: async (method: string, params?: unknown) => {
      const record = paramsRecord(params)
      calls.push({ method, params: record })
      let response: RpcResponse | undefined
      handleRequest(
        { id: `feedback-${++sequence}`, method, params: record },
        (next) => {
          response = next
        },
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only terminal.subscribe reads the socket.
        {} as WebSocket
      )
      if (!response) {
        throw new Error(`mock server did not answer ${method}`)
      }
      return toClientResponse(response)
    }
  }
}

describe('feedback message', () => {
  it('writes the desktop annotation shape: heading, header table, intent, comment, screenshot', () => {
    expect(
      formatFeedbackMarkdown({
        header: HEADER,
        intent: 'change',
        comment: '  The CTA overlaps the price.\nMake it wrap.  ',
        image: { width: 1206, height: 2148, markedUp: true }
      })
    ).toBe(
      [
        '## Design feedback: /pricing?plan=pro',
        '',
        '| Field | Value |',
        '|---|---|',
        '| URL | http://localhost:5173/pricing?plan=pro |',
        '| Browser tab id | page-7 |',
        '| Viewport | 402x716 |',
        '| View mode | mobile |',
        '| Device | iPhone 17 Pro |',
        '| OS | iOS 26.3 |',
        '| App | Orca Review 0.1.0 (1) |',
        '',
        '**Intent:** change',
        '**Feedback:**',
        'The CTA overlaps the price.\nMake it wrap.',
        '',
        '**Screenshot** (phone screencast frame, 1206x2148, marked up on the phone):'
      ].join('\n')
    )
  })

  it('keeps table cells on one row and strips control bytes that could end the paste', () => {
    const markdown = formatFeedbackMarkdown({
      header: { ...HEADER, pageUrl: 'file | name\n.html', browserTabId: null, viewport: null },
      intent: 'question',
      comment: 'why\x1b[201~ is this red?\r\nok',
      image: null
    })
    expect(markdown).toContain('| URL | file \\| name .html |')
    expect(markdown).toContain('| Browser tab id | n/a |')
    expect(markdown).toContain('| Viewport | unknown |')
    expect(markdown).toContain('**Intent:** question')
    expect(markdown).toContain('why[201~ is this red?\nok')
    expect(markdown).not.toContain('\x1b')
    expect(markdown).not.toContain('Screenshot')
  })

  it('caps the comment at 4,000 characters without splitting an emoji', () => {
    expect(clampFeedbackComment('a'.repeat(5000))).toHaveLength(FEEDBACK_COMMENT_MAX_CHARS)
    const nearEdge = `${'a'.repeat(FEEDBACK_COMMENT_MAX_CHARS - 1)}😀tail`
    expect(clampFeedbackComment(nearEdge)).toBe('a'.repeat(FEEDBACK_COMMENT_MAX_CHARS - 1))
  })

  it('heads the message with the page path, or the label for a local file', () => {
    expect(feedbackPageHeading('https://example.com/a/b?c=1#x')).toBe('/a/b?c=1')
    expect(feedbackPageHeading('docs/review.html')).toBe('docs/review.html')
    expect(feedbackPageHeading('')).toBe('current page')
  })

  it('pastes the markdown and the image path as two bracketed pastes', () => {
    expect(buildFeedbackTerminalText('## hi\x1b', '/tmp/a.png', 'claude')).toBe(
      '\x1b[200~## hi␛\x1b[201~ \x1b[200~/tmp/a.png\x1b[201~'
    )
    // An agent that does not attach raw paths gets the @-reference desktop paste gives it.
    expect(buildFeedbackTerminalText('m', '/tmp/a.png', null)).toBe(
      '\x1b[200~m\x1b[201~ \x1b[200~@/tmp/a.png\x1b[201~'
    )
    expect(buildFeedbackClipboardText('m', '/tmp/a.png')).toBe('m /tmp/a.png')
  })
})

describe('feedback send against the mock server', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Big enough to need three chunks, so the upload is really chunked.
  const imageBase64 = Buffer.alloc(
    Math.ceil((MOBILE_CLIPBOARD_IMAGE_UPLOAD_CHUNK_BASE64_CHARS * 2.5 * 3) / 4),
    7
  ).toString('base64')

  it('uploads in chunks, pastes, waits, then presses Enter', async () => {
    const client = mockServerClient()
    const sleeps: number[] = []
    const markdown = formatFeedbackMarkdown({
      header: HEADER,
      intent: 'change',
      comment: 'Box is misaligned',
      image: { width: 1206, height: 2148, markedUp: true }
    })

    const result = await deliverFeedbackToTerminal(
      { terminal: 'term-1', title: 'zsh', agent: 'claude' },
      markdown,
      {
        client,
        readImageBase64: async () => imageBase64,
        connectionId: 'conn-1',
        sleep: async (ms) => {
          sleeps.push(ms)
        }
      }
    )

    expect(client.calls.map((call) => call.method)).toEqual([
      'clipboard.startImageUpload',
      'clipboard.appendImageUploadChunk',
      'clipboard.appendImageUploadChunk',
      'clipboard.appendImageUploadChunk',
      'clipboard.commitImageUpload',
      'terminal.send',
      'terminal.send'
    ])
    expect(client.calls[0].params).toMatchObject({
      expectedBase64Length: imageBase64.length,
      connectionId: 'conn-1'
    })
    expect(readMockClipboardImage(result.hostImagePath)).toBe(imageBase64)
    const [paste, submit] = client.calls.slice(-2).map((call) => call.params)
    expect(paste).toEqual({
      terminal: 'term-1',
      text: buildFeedbackTerminalText(markdown, result.hostImagePath, 'claude'),
      enter: false
    })
    expect(String(paste.text)).toContain('## Design feedback: /pricing?plan=pro')
    // The image path arrives as its own bracketed paste, last.
    const imagePaste = new RegExp(
      `${'\x1b'}\\[200~/tmp/orca-clipboard/mock-upload-\\d+\\.png${'\x1b'}\\[201~$`
    )
    expect(String(paste.text)).toMatch(imagePaste)
    expect(submit).toEqual({ terminal: 'term-1', enter: true })
    expect(sleeps).toEqual([feedbackSubmitDelayMs(String(paste.text))])
  })

  it('types nothing when the upload fails', async () => {
    const client = mockServerClient()
    await expect(
      deliverFeedbackToTerminal({ terminal: 'term-1', title: 'zsh' }, 'm', {
        client,
        readImageBase64: async () => 'not base64!',
        connectionId: null,
        sleep: async () => {}
      })
    ).rejects.toThrow('base64')
    expect(client.calls.some((call) => call.method === 'terminal.send')).toBe(false)
  })

  it('lists the worktree terminals and creates a new agent session for the other targets', async () => {
    const client = mockServerClient()
    const terminals = await listFeedbackTerminals(client, 'wt-1')
    expect(terminals).toEqual([
      { id: 'tab-1::f47ac10b-58cc-4372-a567-0e02b2c3d479', terminal: 'term-1', title: 'zsh' }
    ])
    const created = await createFeedbackTerminal(client, 'wt-1')
    expect(created).toMatchObject({
      terminal: expect.stringMatching(/^term-new-/),
      agent: 'claude'
    })
    expect(client.calls.at(-1)).toEqual({
      method: 'session.tabs.createTerminal',
      params: { worktree: 'id:wt-1', activate: false, select: true, navigation: 'caller' }
    })
  })

  it('reports a locked terminal instead of a delivery', async () => {
    const client = mockServerClient()
    const locked: FeedbackRpcSender = {
      sendRequest: async (method, params, options) =>
        method === 'terminal.send'
          ? { id: 'x', ok: true, result: { send: { accepted: false } }, _meta: { runtimeId: 'r' } }
          : client.sendRequest(method, params, options)
    }
    await expect(
      deliverFeedbackToTerminal({ terminal: 'term-1', title: 'zsh' }, 'm', {
        client: locked,
        readImageBase64: async () => 'AAAA',
        connectionId: null,
        sleep: async () => {}
      })
    ).rejects.toThrow('Terminal input is locked')
  })
})
