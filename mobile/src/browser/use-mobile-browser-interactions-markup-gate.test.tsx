/**
 * While feedback markup is armed the finger draws on a frozen screenshot, so no touch on the
 * viewport may reach the live page as a click, a right click or a wheel scroll. Disarming hands the
 * viewport back to normal interaction.
 */
import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { useMobileBrowserInteractions } from './use-mobile-browser-interactions'

type ResponderConfig = {
  onStartShouldSetPanResponder: () => boolean
  onMoveShouldSetPanResponder: () => boolean
  onPanResponderGrant: (event: unknown) => void
  onPanResponderMove: (event: unknown, gesture: { dx: number; dy: number }) => void
  onPanResponderRelease: (event: unknown, gesture: { dx: number; dy: number }) => void
}

// The last responder config the hook built; the mocked PanResponder records it here.
const responder = vi.hoisted(() => {
  const holder: { config: ResponderConfig | null } = { config: null }
  return holder
})

vi.mock('react-native', () => ({
  PanResponder: {
    create: (config: ResponderConfig) => {
      responder.config = config
      return { panHandlers: {} }
    }
  }
}))

const sent = vi.hoisted(() => {
  const record: { clicks: string[]; wheels: number } = { clicks: [], wheels: 0 }
  return record
})

vi.mock('./use-mobile-browser-commands', () => ({
  useMobileBrowserCommands: () => ({
    mapTouchPoint: (x: number, y: number) => ({ x, y }),
    sendDialogCommand: vi.fn(),
    sendKeyboardText: vi.fn(),
    sendKeypress: vi.fn(),
    sendPointerClick: vi.fn(async (_point: unknown, button: string) => {
      sent.clicks.push(button)
    }),
    sendWheel: vi.fn(() => {
      sent.wheels += 1
    }),
    togglePointerModifier: vi.fn()
  })
}))

const touch = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } })

function mountResponder(markupArmedRef: { current: boolean }): ResponderConfig {
  responder.config = null
  function Screen(): null {
    useMobileBrowserInteractions({
      clearLongPressTimer: () => {},
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the commands hook is mocked, so the client is never called.
      client: {} as RpcClient,
      dialogRef: { current: null },
      frameGeometry: null,
      frameMetadataRef: { current: null },
      keyboardValue: '',
      layoutRef: { current: null },
      longPressTimerRef: { current: null },
      markupArmedRef,
      onToast: () => {},
      pageParams: () => null,
      panRef: { current: null },
      pinchRef: { current: null },
      pointerModifiers: [],
      sendBrowserRequest: async () => null,
      setDialog: () => {},
      setError: () => {},
      setKeyboardValue: () => {},
      scrollingRef: { current: false },
      startPointRef: { current: null },
      setPointerModifiers: () => {},
      setZoom: () => {},
      zoomRef: { current: { scale: 1, offsetX: 0, offsetY: 0 } }
    })
    return null
  }
  act(() => {
    create(createElement(Screen))
  })
  if (!responder.config) {
    throw new Error('nothing mounted')
  }
  return responder.config
}

function tap(config: ResponderConfig): void {
  config.onPanResponderGrant(touch(40, 60))
  config.onPanResponderRelease(touch(41, 60), { dx: 1, dy: 0 })
}

function drag(config: ResponderConfig): void {
  config.onPanResponderGrant(touch(40, 60))
  config.onPanResponderMove(touch(40, 160), { dx: 0, dy: 100 })
  config.onPanResponderRelease(touch(40, 160), { dx: 0, dy: 100 })
}

describe('markup input gate', () => {
  beforeEach(() => {
    sent.clicks.length = 0
    sent.wheels = 0
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('forwards a tap and a scroll while markup is not armed', () => {
    const config = mountResponder({ current: false })
    expect(config.onStartShouldSetPanResponder()).toBe(true)
    tap(config)
    drag(config)
    expect(sent.clicks).toEqual(['left'])
    expect(sent.wheels).toBe(1)
  })

  it('does not claim the touch while armed, and drops a gesture already in flight', () => {
    const armed = { current: true }
    const config = mountResponder(armed)
    expect(config.onStartShouldSetPanResponder()).toBe(false)
    expect(config.onMoveShouldSetPanResponder()).toBe(false)
    tap(config)
    drag(config)
    expect(sent.clicks).toEqual([])
    expect(sent.wheels).toBe(0)
  })

  it('sends no right click when markup arms during a long press', () => {
    const armed = { current: false }
    const config = mountResponder(armed)
    config.onPanResponderGrant(touch(40, 60))
    armed.current = true
    vi.advanceTimersByTime(1_000)
    config.onPanResponderRelease(touch(40, 60), { dx: 0, dy: 0 })
    expect(sent.clicks).toEqual([])
  })

  it('returns to normal interaction when markup exits', () => {
    const armed = { current: true }
    const config = mountResponder(armed)
    tap(config)
    armed.current = false
    expect(config.onStartShouldSetPanResponder()).toBe(true)
    tap(config)
    expect(sent.clicks).toEqual(['left'])
  })
})
