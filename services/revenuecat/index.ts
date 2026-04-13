import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

/**
 * RevenueCat iOS API key (test). Swap for production key before App Store submission.
 * Android uses Stripe — RC is skipped entirely on Android.
 */
const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_API_KEY || 'test_fXbDGfmGBFgfsmabWMPRimKraaJ';

/** Whether RC should be active on the current platform */
export const isRCEnabled = Platform.OS === 'ios';

/**
 * Initialize the RevenueCat SDK. Safe to call multiple times — SDK ignores
 * subsequent calls after the first configuration.
 * Must be called before any other RC methods.
 */
export function initRevenueCat() {
  if (!isRCEnabled) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
  }

  Purchases.configure({ apiKey: RC_IOS_API_KEY });
}

/**
 * Identify the logged-in user to RevenueCat.
 * Using authUser.id (MongoDB _id) as the RC app user ID ensures
 * RC webhooks can cross-reference with your backend.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!isRCEnabled) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.warn('[revenuecat:identify] logIn failed', error);
  }
}

/**
 * Reset RevenueCat user on sign-out.
 * This reverts to an anonymous RC user so the next login starts fresh.
 */
export async function resetUser(): Promise<void> {
  if (!isRCEnabled) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    // logOut throws if the user is already anonymous — safe to ignore
    console.warn('[revenuecat:reset] logOut failed (may be anonymous already)', error);
  }
}
