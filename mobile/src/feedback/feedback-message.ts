export const FEEDBACK_COMMENT_MAX_CHARS = 4000

export type FeedbackIntent = 'change' | 'question'

/** What the phone knows about the page and itself, written as the message's header table. */
export type FeedbackHeader = {
  pageUrl: string
  browserTabId: string | null
  viewport: { width: number; height: number } | null
  viewMode: string
  deviceModel: string
  os: string
  appVersion: string
}

export type FeedbackImageInfo = { width: number; height: number; markedUp: boolean }

/** Caps at 4,000 characters (TestFlight's comment limit) without splitting a surrogate pair. */
export function clampFeedbackComment(text: string): string {
  if (text.length <= FEEDBACK_COMMENT_MAX_CHARS) {
    return text
  }
  let end = FEEDBACK_COMMENT_MAX_CHARS
  const last = text.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) {
    end -= 1
  }
  return text.slice(0, end)
}

/** `/path?query` of the page, as the desktop annotation heading names it. */
export function feedbackPageHeading(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${url.pathname}${url.search}`
    }
  } catch {
    // Not a URL (an HTML file path): the label itself is the heading.
  }
  return pageUrl || 'current page'
}

export function feedbackHeaderRows(header: FeedbackHeader): [string, string][] {
  return [
    ['URL', header.pageUrl || 'unknown'],
    ['Browser tab id', header.browserTabId ?? 'n/a'],
    [
      'Viewport',
      header.viewport ? `${header.viewport.width}x${header.viewport.height}` : 'unknown'
    ],
    ['View mode', header.viewMode],
    ['Device', header.deviceModel],
    ['OS', header.os],
    ['App', header.appVersion]
  ]
}

/**
 * The message the agent receives, in the desktop annotation's shape: a "Design feedback" heading
 * on the page path, the auto header, the intent, then the comment. The screenshot line comes last
 * because the image path is pasted right after it as its own bracketed paste.
 */
export function formatFeedbackMarkdown(input: {
  header: FeedbackHeader
  intent: FeedbackIntent
  comment: string
  image: FeedbackImageInfo | null
}): string {
  const comment = sanitizeFeedbackText(clampFeedbackComment(input.comment).trim())
  const lines = [
    `## Design feedback: ${tableCell(feedbackPageHeading(input.header.pageUrl))}`,
    '',
    '| Field | Value |',
    '|---|---|',
    ...feedbackHeaderRows(input.header).map(([name, value]) => `| ${name} | ${tableCell(value)} |`),
    '',
    `**Intent:** ${input.intent}`,
    '**Feedback:**',
    comment || '(no comment)'
  ]
  if (input.image) {
    const note = input.image.markedUp ? ', marked up on the phone' : ''
    lines.push(
      '',
      `**Screenshot** (phone screencast frame, ${input.image.width}x${input.image.height}${note}):`
    )
  }
  return lines.join('\n')
}

// Why: the markdown rides inside a bracketed paste, so an ESC in page-controlled text (a URL, a
// comment pasted from elsewhere) could end the paste early and type the rest as keystrokes.
// oxlint-disable-next-line no-control-regex -- the point is to remove C0 controls.
const CONTROL_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000b-\u001f\u007f]/g

export function sanitizeFeedbackText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(CONTROL_EXCEPT_NEWLINE_TAB, '')
}

function tableCell(value: string): string {
  return sanitizeFeedbackText(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
}
