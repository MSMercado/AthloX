// Expo config plugin: the Android-side setup Health Connect needs that the
// library's own plugin (react-native-health-connect/app.plugin.js) doesn't do.
//
//   1. MainActivity.onCreate must register HealthConnectPermissionDelegate,
//      otherwise requestPermission() crashes with "lateinit property
//      requestPermission has not been initialized".
//   2. The manifest must declare each health permission we read
//      (READ_HEART_RATE, READ_STEPS — StepsCadence is covered by READ_STEPS).
//   3. Android 14+ needs an activity-alias that answers
//      VIEW_PERMISSION_USAGE so Health Connect can link to our privacy policy.
//
// minSdkVersion 26 (also required) is set via expo-build-properties in app.json.

const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_STEPS',
];

function withPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('HealthConnectPermissionDelegate')) return cfg;

    src = src.replace(
      /^(package [^\n]+\n)/m,
      `$1\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate\n`,
    );

    if (/super\.onCreate\([^)]*\)/.test(src)) {
      src = src.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)`,
      );
    } else {
      if (!src.includes('import android.os.Bundle')) {
        src = src.replace(/^(package [^\n]+\n)/m, `$1\nimport android.os.Bundle\n`);
      }
      src = src.replace(
        /(class MainActivity[^{]*\{)/,
        `$1\n  override fun onCreate(savedInstanceState: Bundle?) {\n    super.onCreate(savedInstanceState)\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n  }\n`,
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withHealthManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of HEALTH_PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = manifest.application[0];
    app['activity-alias'] = app['activity-alias'] || [];
    if (!app['activity-alias'].some((a) => a.$['android:name'] === 'ViewPermissionUsageActivity')) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [{
          action:   [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        }],
      });
    }
    return cfg;
  });
}

module.exports = function withHealthConnectAndroid(config) {
  return withHealthManifest(withPermissionDelegate(config));
};
