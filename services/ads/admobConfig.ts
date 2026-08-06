/**
 * AdMob configuration and ID resolution.
 *
 * Uses Google test IDs when __DEV__ is true.
 * Production builds use the environment-specific AdMob IDs.
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
import { TestIds } from 'react-native-google-mobile-ads';

const ANDROID_APP_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
const IOS_APP_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
const ANDROID_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
const IOS_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID;
const ANDROID_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID;
const IOS_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID;

function getUnitId(
  androidId: string | undefined,
  iosId: string | undefined,
  testId: string,
): string {
  if (__DEV__) {
    return testId;
  }
  if (typeof androidId === 'string' && androidId.length > 0 && typeof iosId === 'string' && iosId.length > 0) {
    return iosId;
  }
  // Fallback to test ID if production IDs are missing to prevent crashes.
  return testId;
}

export const AdMobConfig = {
  /** True when running inside Expo Go (no native ads possible). */
  isExpoGo: isRunningInExpoGo(),

  androidAppId: ANDROID_APP_ID ?? '',
  iosAppId: IOS_APP_ID ?? '',

  bannerAdUnitId: getUnitId(ANDROID_BANNER_ID, IOS_BANNER_ID, TestIds.BANNER),
  rewardedAdUnitId: getUnitId(ANDROID_REWARDED_ID, IOS_REWARDED_ID, TestIds.REWARDED),

  /** Screens where banner ads may appear for authenticated free users. */
  allowedBannerRoutes: new Set<string>([
    '/(drawer)/repo',
  ]),

  /** Screens where rewarded ads may be triggered for authenticated free users. */
  allowedRewardedRoutes: new Set<string>([
    '/(drawer)/repo',
    '/(drawer)/tools',
    '/(drawer)/images',
    '/(drawer)/videos',
    '/(drawer)/artifacts',
  ]),
} as const;
