import { isRunningInExpoGo } from 'expo';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

let cachedModule: GoogleMobileAdsModule | null = null;

/** Loads AdMob only in native runtimes that can provide the module. */
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
