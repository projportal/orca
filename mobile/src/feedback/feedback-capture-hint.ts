import AsyncStorage from '@react-native-async-storage/async-storage'

export const FEEDBACK_CAPTURE_HINT_TEXT = 'Capture screenshot for feedback'
export const FEEDBACK_CAPTURE_HINT_KEY = 'orca-review:feedbackCaptureHintSeen'
export const FEEDBACK_CAPTURE_HINT_MS = 4000

type HintStore = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>

/**
 * The camera button's first-use hint, once per install. The claim is made in memory before the
 * store answers, so two panes mounting together never both show it; a store that cannot be read
 * skips the hint rather than repeating it on every launch.
 */
export function createFeedbackCaptureHintGate(store: HintStore = AsyncStorage) {
  let claimed = false
  return {
    async claim(): Promise<boolean> {
      if (claimed) {
        return false
      }
      claimed = true
      try {
        if ((await store.getItem(FEEDBACK_CAPTURE_HINT_KEY)) === 'true') {
          return false
        }
        await store.setItem(FEEDBACK_CAPTURE_HINT_KEY, 'true')
        return true
      } catch {
        return false
      }
    }
  }
}

export const feedbackCaptureHintGate = createFeedbackCaptureHintGate()
