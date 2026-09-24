import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() }
}))

const { FEEDBACK_CAPTURE_HINT_KEY, FEEDBACK_CAPTURE_HINT_TEXT, createFeedbackCaptureHintGate } =
  await import('./feedback-capture-hint')

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    })
  }
}

describe('camera first-use hint', () => {
  it('shows once per install and records it in the store', async () => {
    const store = memoryStore()
    expect(await createFeedbackCaptureHintGate(store).claim()).toBe(true)
    expect(store.values.get(FEEDBACK_CAPTURE_HINT_KEY)).toBe('true')
    // A later launch reads the flag back.
    expect(await createFeedbackCaptureHintGate(store).claim()).toBe(false)
    expect(FEEDBACK_CAPTURE_HINT_TEXT).toBe('Capture screenshot for feedback')
  })

  it('shows in one pane only when two mount together', async () => {
    const gate = createFeedbackCaptureHintGate(memoryStore())
    expect(await Promise.all([gate.claim(), gate.claim()])).toEqual([true, false])
  })

  it('skips the hint when the store cannot be read', async () => {
    const store = memoryStore()
    store.getItem.mockRejectedValueOnce(new Error('unavailable'))
    expect(await createFeedbackCaptureHintGate(store).claim()).toBe(false)
  })
})
