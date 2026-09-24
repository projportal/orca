// Orca Review fork: push notifications are off. The fork pairs over LAN and
// Tailscale only and has no APNs gateway, so the iOS build must not carry the
// `aps-environment` entitlement (that would require the Push Notifications
// capability on the App ID for no benefit). The expo-notifications plugin still
// runs, because the app code uses it for local notifications; the small plugin
// below removes the entitlement the notifications plugin would otherwise add.
//
// Upstream derived the entitlement from ORCA_IOS_APS_ENVIRONMENT; to turn push
// back on, restore upstream's version of this file.
//
// app.json stays the source for everything else: Expo reads it first and hands it
// to this function, so the fastlane version/buildNumber rewrite still flows through.
const { withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins')

const withoutApsEnvironment = (config) =>
  withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults['aps-environment']
    return modConfig
  })

// Prebuild writes ios.buildNumber into Info.plist only; keep the app target's
// CURRENT_PROJECT_VERSION equal to it so Xcode shows the same build.
const withBuildNumberInProject = (config) =>
  withXcodeProject(config, (modConfig) => {
    const buildNumber = modConfig.ios?.buildNumber
    if (!buildNumber) {
      return modConfig
    }
    const configurations = modConfig.modResults.pbxXCBuildConfigurationSection()
    for (const entry of Object.values(configurations)) {
      const settings = typeof entry === 'object' ? entry.buildSettings : undefined
      if (settings?.PRODUCT_BUNDLE_IDENTIFIER && 'CURRENT_PROJECT_VERSION' in settings) {
        settings.CURRENT_PROJECT_VERSION = buildNumber
      }
    }
    return modConfig
  })

module.exports = ({ config }) => {
  const { entitlements = {}, ...ios } = config.ios ?? {}
  const { 'aps-environment': _removed, ...otherEntitlements } = entitlements
  return {
    ...config,
    ios: { ...ios, entitlements: otherEntitlements },
    // Why first: Expo runs a mod registered later before one registered earlier, so the
    // stripper must be registered first to run after expo-notifications adds the entitlement.
    plugins: [
      withoutApsEnvironment,
      withBuildNumberInProject,
      ...(config.plugins ?? []).map((plugin) =>
        plugin === 'expo-notifications'
          ? ['expo-notifications', { icon: './assets/notification-icon.png' }]
          : plugin
      )
    ]
  }
}
