import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Settings, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MobileBrowserPane, type MobileBrowserTab } from '../../browser/MobileBrowserPane'
import { MobileHtmlPreview } from '../../components/MobileHtmlPreview'
import { colors, spacing } from '../../theme/mobile-theme'
import type {
  MobileFeedbackBinding,
  MobileFeedbackHostProps,
  MobileFeedbackKit
} from '../mobile-feedback-kit'
import { MOBILE_FEEDBACK_KIT, MobileFeedbackHost } from '../MobileFeedbackHost'
import type { MobileFeedbackFlow } from '../use-mobile-feedback-flow'
import {
  createFeedbackDemoRpcClient,
  type DemoRpcLogEntry
} from '../../../scripts/mock-feedback-demo-desktop'
import {
  FEEDBACK_DEMO_COMMENT,
  feedbackDemoMarkupSeed,
  parseFeedbackDemoStep,
  type FeedbackDemoStep
} from './feedback-demo-seeds'

/**
 * Dev-only route body: the real browser pane, fed one sample frame by a stand-in desktop, walked
 * to one step of the feedback flow so each step can be screenshotted on a simulator with no paired
 * desktop (`xcrun simctl openurl booted "orca://feedback-demo?step=markup"`). Metro swaps this
 * module for `feedback-demo-disabled.tsx` unless the bundle is built with
 * ORCA_REVIEW_FEEDBACK_DEMO=1, so neither it nor the sample frame ships in a release build.
 */
const DemoStepContext = createContext<FeedbackDemoStep>('toolbar')

const DEMO_TAB: MobileBrowserTab = {
  type: 'browser',
  id: 'demo-browser-tab',
  title: 'Acme Cloud – Pricing',
  browserWorkspaceId: 'demo-workspace',
  browserPageId: 'page-7',
  url: 'http://localhost:5173/pricing?plan=pro',
  loading: false,
  canGoBack: true,
  canGoForward: false,
  isActive: true
}

const DEMO_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<style>body{font-family:-apple-system;margin:0;padding:24px;background:#f7f7fb;color:#15152a}
h1{font-size:28px;margin:8px 0}p{color:#66667a}.card{background:#fff;border:1px solid #dcdcea;
border-radius:16px;padding:18px;margin-top:18px}.btn{display:inline-block;background:#5b5bf0;
color:#fff;padding:12px 18px;border-radius:10px;font-weight:600}</style></head><body>
<h1>Release notes</h1><p>Agent-written summary of this week's changes.</p>
<div class="card"><b>Pricing page</b><p>New Pro plan card and yearly toggle.</p>
<span class="btn">Open preview</span></div><div class="card"><b>Onboarding</b>
<p>Three-step checklist replaces the welcome modal.</p></div></body></html>`

function stepNeedsComposer(step: FeedbackDemoStep): boolean {
  return step === 'composer' || step === 'picker' || step === 'delivered'
}

const fastSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.min(ms, 300)))

/** The real host, walked to the demo step by the same actions a finger would take. */
function DemoHost(props: MobileFeedbackHostProps) {
  const step = useContext(DemoStepContext)
  const flowRef = useRef<MobileFeedbackFlow | null>(null)
  const done = useRef({ capture: false, markup: false, comment: false, next: false })
  // Interval ticks since mount: the HTML preview's WebView gets ~2 s to paint before its shot.
  const ticks = useRef(0)
  const onFlow = useCallback((flow: MobileFeedbackFlow) => {
    flowRef.current = flow
  }, [])
  const seed = useMemo(() => feedbackDemoMarkupSeed(step), [step])

  useEffect(() => {
    const timer = setInterval(() => {
      ticks.current += 1
      const flow = flowRef.current
      if (!flow || step === 'toolbar') {
        return
      }
      const state = flow.state
      if (state.kind === 'idle' && !done.current.capture) {
        if (props.source.kind === 'browser-frame') {
          const uri = props.source.getFrameUri()
          if (uri) {
            done.current.capture = true
            flow.captureFrame(uri)
          }
        } else if (ticks.current > 7) {
          done.current.capture = true
          flow.captureView(props.source.viewRef)
        }
      } else if (
        state.kind === 'captured' &&
        !done.current.markup &&
        step !== 'captured' &&
        step !== 'html'
      ) {
        done.current.markup = true
        flow.dispatch({ type: 'open-markup' })
      } else if (state.kind === 'composing' && !done.current.comment) {
        done.current.comment = true
        flow.dispatch({ type: 'set-comment', comment: FEEDBACK_DEMO_COMMENT })
        flow.dispatch({ type: 'set-intent', intent: 'change' })
      } else if (state.kind === 'composing' && !done.current.next) {
        done.current.next = true
        if (step === 'picker') {
          void flow.openPicker()
        } else if (step === 'delivered') {
          flow.sendToTerminal({ terminal: 'term-demo-1', title: 'claude', agent: 'claude' })
        }
      }
    }, 300)
    return () => clearInterval(timer)
  }, [props.source, step])

  return (
    <MobileFeedbackHost
      {...props}
      markupSeed={seed}
      markupAutoFinishMs={stepNeedsComposer(step) ? 1500 : undefined}
      onFlow={onFlow}
      sleep={fastSleep}
    />
  )
}

const DEMO_KIT: MobileFeedbackKit = { ...MOBILE_FEEDBACK_KIT, Host: DemoHost }

/**
 * Opens the demo from a launch argument, because `simctl openurl` stops on an "Open in …?" prompt
 * that simctl cannot tap: `xcrun simctl launch <device> com.portalinteractive.orcareview
 * -orcaReviewFeedbackDemo markup` (iOS puts `-key value` launch arguments in NSUserDefaults).
 * Mounted by the root layout; the release stub renders nothing.
 */
export function FeedbackDemoLaunch(): null {
  const router = useRouter()
  useEffect(() => {
    const step: unknown = Settings.get('orcaReviewFeedbackDemo')
    if (typeof step !== 'string' || !step) {
      return
    }
    const timer = setTimeout(() => {
      router.push({ pathname: '/feedback-demo', params: { step } })
    }, 600)
    return () => clearTimeout(timer)
  }, [router])
  return null
}

export function FeedbackDemoScreen() {
  const params = useLocalSearchParams<{ step?: string }>()
  const step = parseFeedbackDemoStep(params.step)
  const insets = useSafeAreaInsets()
  const [log, setLog] = useState<DemoRpcLogEntry[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const client = useMemo(
    () =>
      // The whole log: one demo run makes a few dozen calls, and the header counts them.
      createFeedbackDemoRpcClient((entry) => setLog((current) => [...current, entry])),
    []
  )
  const binding = useMemo<MobileFeedbackBinding>(
    () => ({
      kit: DEMO_KIT,
      client,
      worktreeId: 'demo-worktree',
      getConnectionId: async () => null,
      onToast: (message) => setToast(message)
    }),
    [client]
  )
  const uploads = log.filter((entry) => entry.method.startsWith('clipboard.')).length
  return (
    <DemoStepContext.Provider value={step}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Orca Review · feedback demo</Text>
          <Text style={styles.meta}>
            {`step: ${step} · sample frame, stand-in desktop`}
            {log.length > 0
              ? ` · last call: ${log[log.length - 1].method} ${log[log.length - 1].summary}`
              : ''}
            {uploads > 0 ? ` · ${uploads} clipboard upload calls` : ''}
          </Text>
        </View>
        {step === 'html' ? (
          <MobileHtmlPreview
            html={DEMO_HTML}
            renderSource={() => null}
            feedback={{ ...binding, pageLabel: 'docs/release-notes.html' }}
          />
        ) : (
          <MobileBrowserPane
            client={client}
            worktreeId="demo-worktree"
            tab={DEMO_TAB}
            screencastSupported
            keyboardLift={0}
            bottomInset={insets.bottom}
            onToast={(message) => setToast(message)}
            feedback={binding}
          />
        )}
        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </DemoStepContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  toast: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  toastText: { color: colors.textPrimary, fontSize: 13 }
})
