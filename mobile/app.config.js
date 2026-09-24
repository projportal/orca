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
const { withEntitlementsPlist } = require('expo/config-plugins')

const withoutApsEnvironment = (config) =>
  withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults['aps-environment']
    return modConfig
  })

module.exports = ({ config }) => {
  const { entitlements = {}, ...ios } = config.ios ?? {}
  const { 'aps-environment': _removed, ...otherEntitlements } = entitlements
  return {
    ...config,
    ios: { ...ios, entitlements: otherEntitlements },
    plugins: [
      ...(config.plugins ?? []).map((plugin) =>
        plugin === 'expo-notifications'
          ? ['expo-notifications', { icon: './assets/notification-icon.png' }]
          : plugin
      ),
      withoutApsEnvironment
    ]
  }
}
