const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '..', 'src', 'shared')

const config = getDefaultConfig(projectRoot)

// Why: mobile source-control prompts use the same pure builders as desktop.
// Metro only watches mobile/ by default, so make repo-root shared modules visible.
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), sharedRoot]))

/**
 * The shell kind the bundle is being built for, by the same rule `mobileShellBuildKind` applies in
 * `src/storage/preferences.ts`. This read runs in Node at config time, so it is not the second
 * inlined read that module's census forbids.
 */
const shellBuildKind = process.env.EXPO_PUBLIC_MOBILE_SHELL === 'ota' ? 'ota' : 'native'

// Why: babel-preset-expo inlines EXPO_PUBLIC_MOBILE_SHELL at transform time, but nothing Metro
// hashes into the transform cache key carries that value, so a warm cache from the opposite kind
// silently bakes the wrong shell into a release.
config.cacheVersion = `${config.cacheVersion}-shell-${shellBuildKind}`

/**
 * Orca Review: the feedback demo route (app/feedback-demo.tsx) shows the screenshot → markup →
 * send flow on a bundled sample frame, for simulator screenshots with no paired desktop. Only a
 * bundle built with ORCA_REVIEW_FEEDBACK_DEMO=1 gets the real screen; every other bundle — every
 * TestFlight and release build — resolves it to a redirect, so the demo screen, its stand-in
 * desktop and the ~150 KB sample frame are not in the bundle at all.
 */
const feedbackDemoEnabled = process.env.ORCA_REVIEW_FEEDBACK_DEMO === '1'
const FEEDBACK_DEMO_ENTRY = /(^|\/)feedback\/demo\/feedback-demo-entry$/
// No cacheVersion change: this is a resolution, not a transform, and Metro does not persist
// resolutions, so a warm transform cache cannot carry the other build's choice.
const upstreamResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!feedbackDemoEnabled && FEEDBACK_DEMO_ENTRY.test(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.join(projectRoot, 'src', 'feedback', 'demo', 'feedback-demo-disabled.tsx')
    }
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
