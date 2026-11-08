const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartext(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    androidManifest.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
