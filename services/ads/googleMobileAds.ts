import { isRunningInExpoGo } from 'expo';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

let cachedModule: GoogleMobileAdsModule | null = null;

/**
 * Loads the native ads package only in runtimes that can actually provide it.
 * A static import crashes Expo Go before component-level guards can run.
 */
export function getGoogleMobileAds(): GoogleMobileAdsModule | null {
  if (isRunningInExpoGo()) return null;
  if (cachedModule) return cachedModule;

  try {
    cachedModule = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
    return cachedModule;
  } catch (error) {
    if (__DEV__) console.warn('[ads] Native Google Mobile Ads module is unavailable.', error);
    return null;
  }
}
