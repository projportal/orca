import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { Code, Eye } from 'lucide-react-native'
import { openExternalLink } from '../platform/external-link'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { useHtmlPreviewFeedback, type HtmlPreviewFeedback } from './use-html-preview-feedback'

export type MobileHtmlPreviewProps = {
  html: string
  // Rendered when the user flips to "Source" (the existing syntax view).
  renderSource: () => React.ReactNode
  /** Orca Review: screenshot the rendered page for feedback. Ignored by the page build. */
  feedback?: HtmlPreviewFeedback
}

// Renders an agent-produced HTML artifact in a sandboxed WebView, with a
// Preview/Source toggle. Navigation is locked: only the initial inline document
// loads in-place; any link tap opens externally so a page can't hijack the
// review surface.
export function MobileHtmlPreview({ html, renderSource, feedback }: MobileHtmlPreviewProps) {
  const [mode, setMode] = useState<'preview' | 'source'>('preview')
  const previewFeedback = useHtmlPreviewFeedback(feedback)

  return (
    <View style={styles.container}>
      {/* A tab pair, not two buttons: which side is showing is carried by the active style, and a
          style is announced to nobody. */}
      <View style={styles.toolbar} accessibilityRole="tablist">
        <Pressable
          style={[styles.toggle, mode === 'preview' && styles.toggleActive]}
          onPress={() => setMode('preview')}
          accessibilityRole="tab"
          // Both, because they reach different readers: `accessibilityState` is what the phone's
          // screen reader takes, and react-native-web drops it entirely -- measured, the DOM carries
          // no `aria-selected` without the line below.
          accessibilityState={{ selected: mode === 'preview' }}
          aria-selected={mode === 'preview'}
          accessibilityLabel="Preview rendered HTML"
        >
          <Eye size={13} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.toggleText}>Preview</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, mode === 'source' && styles.toggleActive]}
          onPress={() => setMode('source')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'source' }}
          aria-selected={mode === 'source'}
          accessibilityLabel="View HTML source"
        >
          <Code size={13} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.toggleText}>Source</Text>
        </Pressable>
        {mode === 'preview' && previewFeedback.toolbarButton ? (
          <View style={styles.toolbarEnd}>{previewFeedback.toolbarButton}</View>
        ) : null}
      </View>
      {mode === 'preview' ? (
        <View style={styles.previewHost}>
          {/* The screenshot target: the WebView alone, never the feedback layer beside it. */}
          <View
            ref={previewFeedback.viewRef}
            collapsable={false}
            style={styles.previewHost}
            onLayout={(event) => previewFeedback.onLayout(event.nativeEvent.layout)}
          >
            <WebView
              style={styles.webview}
              originWhitelist={['*']}
              source={{ html }}
              javaScriptEnabled
              // Why: only the initial about:blank inline-HTML load is allowed in
              // place; a tapped link opens in the system browser instead of
              // navigating the review WebView away from the artifact.
              onShouldStartLoadWithRequest={(request) => {
                if (request.url === 'about:blank' || request.url.startsWith('data:')) {
                  return true
                }
                openExternalLink(request.url)
                return false
              }}
            />
          </View>
          {previewFeedback.layer}
        </View>
      ) : (
        renderSource()
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgRaised
  },
  toggleActive: {
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  toggleText: { color: colors.textSecondary, fontSize: typography.metaSize },
  toolbarEnd: { marginLeft: 'auto', justifyContent: 'center' },
  previewHost: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#ffffff' }
})
