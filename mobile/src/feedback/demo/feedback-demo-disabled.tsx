import { Redirect } from 'expo-router'

/**
 * What `feedback-demo-entry` resolves to in every bundle not built with
 * ORCA_REVIEW_FEEDBACK_DEMO=1 (metro.config.js): the demo route just goes home, and neither the
 * demo screen nor its sample frame is in the bundle.
 */
export function FeedbackDemoScreen() {
  return <Redirect href="/" />
}

/** The demo's launch-argument opener does nothing outside a demo build. */
export function FeedbackDemoLaunch(): null {
  return null
}
