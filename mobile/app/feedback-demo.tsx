import { FeedbackDemoScreen } from '../src/feedback/demo/feedback-demo-entry'

/**
 * Orca Review dev-only demo of the screenshot → markup → send flow on a sample frame. In a normal
 * build metro resolves the import above to a redirect home (see metro.config.js).
 */
export default function FeedbackDemoRoute() {
  return <FeedbackDemoScreen />
}
