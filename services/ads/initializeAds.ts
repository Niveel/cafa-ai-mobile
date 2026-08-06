/**
 * Google AdMob initialization with UMP (User Messaging Platform) consent.
 *
 * Startup order:
 * 1. Update consent information.
 * 2. Show the consent form if required.
 * 3. Confirm ads may be requested.
 * 4. Initialize mobileAds once.
 *
 * Errors are handled gracefully so a failed consent request or unavailable ad
 * never crashes or blocks the app.
 *
 * NOTE: This package includes native code. A new EAS development build is
 * required after installation. Real ads will not work in Expo Go.
 */

import { Platform } from 'react-native';
import {
  AdsConsent,
  AdsConsentStatus,
  mobileAds,
} from 'react-native-google-mobile-ads';
import { AdMobConfig } from './admobConfig';

let hasInitialized = false;

export async function initializeAds(): Promise<void> {
  if (hasInitialized) {
    return;
  }

  // Do not attempt initialization in Expo Go because native modules are unavailable.
  if (AdMobConfig.isExpoGo) {
    if (__DEV__) {
      console.log('[ads] Skipping initialization in Expo Go.');
    }
    hasInitialized = true;
    return;
  }

  try {
    // Step 1: Update consent information.
    const consentInfo = await AdsConsent.requestInfoUpdate();

    // Step 2: Show the consent form if required.
    if (
      consentInfo.status === AdsConsentStatus.REQUIRED ||
      consentInfo.status === AdsConsentStatus.UNKNOWN
    ) {
      try {
        await AdsConsent.showForm();
      } catch (formError) {
        // Non-fatal: user may have dismissed the form or it is unavailable.
        if (__DEV__) {
          console.warn('[ads:consent] Form display error:', formError);
        }
      }
    }

    // Step 3: Confirm ads may be requested.
    const finalConsentInfo = await AdsConsent.requestInfoUpdate();
    const canRequestAds = finalConsentInfo.canRequestAds ?? true;

    if (!canRequestAds) {
      if (__DEV__) {
        console.log('[ads] Ads cannot be requested per user consent.');
      }
      hasInitialized = true;
      return;
    }

    // Step 4: Initialize the Mobile Ads SDK once.
    await mobileAds().initialize();
    hasInitialized = true;

    if (__DEV__) {
      console.log('[ads] Mobile Ads SDK initialized successfully.');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[ads:init] Initialization error:', error);
    }
    // Mark as initialized anyway so we do not retry repeatedly and spam errors.
    hasInitialized = true;
  }
}

export function getAdsInitialized(): boolean {
  return hasInitialized;
}
