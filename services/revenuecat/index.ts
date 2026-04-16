import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

/**
 * RevenueCat iOS API key.
 * Android uses Stripe — RC is skipped entirely on Android.
 */
const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_API_KEY?.trim() ?? '';

/** Whether RC should be active on the current platform */
export const isRCEnabled = Platform.OS === 'ios' && RC_IOS_API_KEY.length > 0;

let hasConfiguredRevenueCat = false;

/**
 * Initialize the RevenueCat SDK. Safe to call multiple times — SDK ignores
 * subsequent calls after the first configuration.
 * Must be called before any other RC methods.
 */
export function initRevenueCat() {
  if (Platform.OS !== 'ios') return;
  if (hasConfiguredRevenueCat) return;
  if (!RC_IOS_API_KEY) {
    console.warn('[revenuecat:init] EXPO_PUBLIC_RC_IOS_API_KEY is missing. RevenueCat is disabled for this build.');
    return;
  }

  try {
    // Use a custom log handler to prevent RevenueCat's default console.error
    // from crashing the app in production or showing redboxes in dev.
    Purchases.setLogHandler((logLevel, message) => {
      if (__DEV__) {
        // Just console.log the messages even if they are errors, to avoid redboxes
        console.log(`[RC Log] [${logLevel}] ${message}`);
      }
    });
    Purchases.configure({ apiKey: RC_IOS_API_KEY });
    hasConfiguredRevenueCat = true;
  } catch (error) {
    console.warn('[revenuecat:init] configure failed. RevenueCat is disabled for this session.', error);
  }
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
