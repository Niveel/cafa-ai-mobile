/**
 * AdMob configuration and ID resolution.
 *
 * Uses production IDs by default in every native build so rewarded-ad SSV
 * always targets the configured publisher unit. Google test IDs are opt-in
 * through EXPO_PUBLIC_ADMOB_USE_TEST_IDS=true.
 *
 * Privacy & policy notes:
 * - Android: the app contains ads declaration must be set in Google Play Console.
 * - Google Play Data Safety form may need updating for AdMob data usage.
 * - iOS: App Privacy label may need updating for advertising data usage.
 * - ATT (App Tracking Transparency) must not block app usage.
 *   Users who reject tracking must still be able to use Cafa AI.
 * - Never show real ads in Expo Go; this package requires a development/EAS build.
 */

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

// Official Google test unit IDs. Keeping these local avoids importing the
// native ads package while Expo Go is starting.
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const PRODUCTION_IDS = {
  android: {
    app: 'ca-app-pub-6955909048819100~8821002172',
    banner: 'ca-app-pub-6955909048819100/2178700063',
    rewarded: 'ca-app-pub-6955909048819100/2504903045',
    interstitial: 'ca-app-pub-6955909048819100/7103296059',
  },
  ios: {
    app: 'ca-app-pub-6955909048819100~4060413904',
    banner: 'ca-app-pub-6955909048819100/6379020711',
    rewarded: 'ca-app-pub-6955909048819100/1405895630',
    interstitial: 'ca-app-pub-6955909048819100/2493398988',
  },
} as const;

const ANDROID_APP_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
const IOS_APP_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
const ANDROID_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
const IOS_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID;
const ANDROID_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID;
const IOS_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID;
const ANDROID_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID;
const IOS_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID;
const USE_TEST_IDS = process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS?.trim().toLowerCase() === 'true';

type AdUnitFormat = 'banner' | 'rewarded' | 'interstitial';

function getUnitId(
  androidId: string | undefined,
  iosId: string | undefined,
  testId: string,
  format: AdUnitFormat,
): string {
  if (USE_TEST_IDS) {
    return testId;
  }
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const configuredId = platform === 'ios' ? iosId?.trim() : androidId?.trim();
  const fallbackId = PRODUCTION_IDS[platform][format];
  return /^ca-app-pub-\d{16}\/\d{10}$/.test(configuredId ?? '') && configuredId
    ? configuredId
    : fallbackId;
}

export const AdMobConfig = {
  /** True when running inside Expo Go (no native ads possible). */
  isExpoGo: isRunningInExpoGo(),
  usesTestIds: USE_TEST_IDS,

  androidAppId: ANDROID_APP_ID?.trim() || PRODUCTION_IDS.android.app,
  iosAppId: IOS_APP_ID?.trim() || PRODUCTION_IDS.ios.app,

  bannerAdUnitId: getUnitId(ANDROID_BANNER_ID, IOS_BANNER_ID, TEST_BANNER_ID, 'banner'),
  rewardedAdUnitId: getUnitId(ANDROID_REWARDED_ID, IOS_REWARDED_ID, TEST_REWARDED_ID, 'rewarded'),
  interstitialAdUnitId: getUnitId(
    ANDROID_INTERSTITIAL_ID,
    IOS_INTERSTITIAL_ID,
    TEST_INTERSTITIAL_ID,
    'interstitial',
  ),

  /** Screens where banner ads may appear for authenticated free users. */
  allowedBannerRoutes: new Set<string>([
    // usePathname() omits Expo Router group segments such as "(drawer)".
    '/repo',
    '/tools',
  ]),

  /** Screens where rewarded ads may be triggered for authenticated free users. */
  allowedRewardedRoutes: new Set<string>([
    '/repo',
    '/tools',
    '/images',
    '/videos',
    '/artifacts',
  ]),
} as const;
