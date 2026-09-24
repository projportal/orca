import type { ComponentType, RefObject } from 'react'
import type { View } from 'react-native'
import type { RpcClient } from '../transport/rpc-client'

/**
 * Types only. The browser pane and the HTML preview import this module and nothing else from the
 * feedback flow: the flow itself (native capture, markup, upload) is handed to them as a kit by
 * the session screen, so their own module closures, tests and page-bundle census are unchanged.
 */

/** What the phone knows about the page when the feedback is written. */
export type MobileFeedbackPageContext = {
  pageUrl: string
  browserTabId: string | null
  viewport: { width: number; height: number } | null
  viewMode: string
}

export type MobileFeedbackCaptureSource =
  /** The browser pane: the last screencast frame, already on the phone as a data URI. */
  | { kind: 'browser-frame'; getFrameUri: () => string | null }
  /** The HTML preview: a snapshot of the mounted view. */
  | { kind: 'view'; viewRef: RefObject<View | null> }

export type MobileFeedbackHostProps = {
  client: RpcClient | null
  worktreeId: string
  getConnectionId: () => Promise<string | null>
  /** Bumped by the Screenshot button; each new value takes one screenshot. */
  captureRequest: number
  source: MobileFeedbackCaptureSource
  getPageContext: () => MobileFeedbackPageContext
  /** True while markup holds the viewport: the pane stops forwarding touches and hides its keys. */
  onViewportHeldChange: (held: boolean) => void
  onToast: (message: string, durationMs?: number) => void
}

export type MobileFeedbackScreenshotButtonProps = {
  disabled: boolean
  onPress: () => void
}

export type MobileFeedbackKit = {
  /** False in the page bundle, where there is no cache directory or view snapshot. */
  supported: boolean
  Host: ComponentType<MobileFeedbackHostProps>
  ScreenshotButton: ComponentType<MobileFeedbackScreenshotButtonProps>
}

/** What the session screen hands a pane that can take screenshots. */
export type MobileFeedbackBinding = {
  kit: MobileFeedbackKit
  client: RpcClient | null
  worktreeId: string
  getConnectionId: () => Promise<string | null>
  onToast: (message: string, durationMs?: number) => void
}
