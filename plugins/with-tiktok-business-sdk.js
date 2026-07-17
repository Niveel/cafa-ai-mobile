const { AndroidConfig, withAndroidManifest, withProjectBuildGradle } = require('expo/config-plugins');

const JITPACK_REPOSITORY = "maven { url 'https://jitpack.io' }";

function withTikTokRepository(config) {
  return withProjectBuildGradle(config, (projectConfig) => {
    if (projectConfig.modResults.language !== 'groovy') {
      throw new Error('TikTok Business SDK config currently supports Groovy Android projects only.');
    }

    const contents = projectConfig.modResults.contents;
    if (contents.includes('jitpack.io')) return projectConfig;

    const allProjectsRepositories = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;
    if (!allProjectsRepositories.test(contents)) {
      throw new Error('Could not find allprojects.repositories in the generated Android build.gradle.');
    }

    projectConfig.modResults.contents = contents.replace(
      allProjectsRepositories,
      `$1\n        ${JITPACK_REPOSITORY}`,
    );
    return projectConfig;
  });
}

function withTikTokAppId(config, appId) {
  return withAndroidManifest(config, (projectConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(projectConfig.modResults);
    mainApplication['meta-data'] = mainApplication['meta-data'] ?? [];
    const existing = mainApplication['meta-data'].find(
      (item) => item.$?.['android:name'] === 'com.tiktok.sdk.AppId',
    );
    const value = { 'android:name': 'com.tiktok.sdk.AppId', 'android:value': appId };

    if (existing) existing.$ = value;
    else mainApplication['meta-data'].push({ $: value });
    return projectConfig;
  });
}

module.exports = function withTikTokBusinessSdk(config, options = {}) {
  const appId = String(options.appId ?? '').trim();
  if (!appId) throw new Error('with-tiktok-business-sdk requires a non-empty appId.');

  config = withTikTokRepository(config);
  config = withTikTokAppId(config, appId);
  return config;
};
