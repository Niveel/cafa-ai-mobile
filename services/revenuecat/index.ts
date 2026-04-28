import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

/**
 * RevenueCat iOS API key.
 * Android uses Stripe - RC is skipped entirely on Android.
 */
const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_API_KEY?.trim() ?? '';

/** Whether RC should be active on the current platform */
export const isRCEnabled = Platform.OS === 'ios';

let hasConfiguredRevenueCat = false;

/**
 * Initialize the RevenueCat SDK. Safe to call multiple times.
 * Must be called before any other RC methods.
 */
export function initRevenueCat() {
  if (Platform.OS !== 'ios') return;
  if (hasConfiguredRevenueCat) return;
  if (!RC_IOS_API_KEY) return;

  try {
    Purchases.configure({ apiKey: RC_IOS_API_KEY });
    hasConfiguredRevenueCat = true;
  } catch {
    // Keep RC disabled for this session.
  }
}

/**
 * Identify the logged-in user to RevenueCat.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!isRCEnabled) return;
  await Purchases.logIn(userId);
}

export async function getRevenueCatAppUserId(): Promise<string | null> {
  if (!isRCEnabled) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

/**
 * Reset RevenueCat user on sign-out.
 */
export async function resetUser(): Promise<void> {
  if (!isRCEnabled) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if the user is already anonymous.
  }
}

/**
 * Open the App Store subscription management page on iOS.
 */
export async function openIosSubscriptionManagement(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Subscription management via App Store is available on iOS only.');
  }

  const candidates = [
    'https://apps.apple.com/account/subscriptions',
    'itms-apps://apps.apple.com/account/subscriptions',
  ];

  for (const url of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) continue;
      await Linking.openURL(url);
      return;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('Could not open App Store subscriptions right now.');
}
