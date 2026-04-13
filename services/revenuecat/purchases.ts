import Purchases from 'react-native-purchases';
import { isRCEnabled } from './index';
import type { RCCustomerInfo, RCOffering, RCPackage } from '@/types/revenuecat.types';

/**
 * Fetch the current RevenueCat CustomerInfo (entitlements, subscriptions).
 * Returns null on Android or if RC is not configured.
 */
export async function fetchCustomerInfo(): Promise<RCCustomerInfo | null> {
  if (!isRCEnabled) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn('[revenuecat:purchases] fetchCustomerInfo failed', error);
    return null;
  }
}

/**
 * Fetch the current RevenueCat offerings.
 * Returns the default offering, or null if unavailable.
 */
export async function fetchOffering(): Promise<RCOffering | null> {
  if (!isRCEnabled) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.warn('[revenuecat:purchases] fetchOffering failed', error);
    return null;
  }
}

/**
 * Purchase a specific RC Package (e.g. the monthly package).
 * Returns updated CustomerInfo on success.
 * Throws on failure — callers must handle errors.
 */
export async function purchasePackage(pkg: RCPackage): Promise<RCCustomerInfo> {
  if (!isRCEnabled) {
    throw new Error('In-app purchases are not available on this platform.');
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/**
 * Restore previous App Store purchases for the current user.
 * Returns updated CustomerInfo on success.
 */
export async function restorePurchases(): Promise<RCCustomerInfo | null> {
  if (!isRCEnabled) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.warn('[revenuecat:purchases] restorePurchases failed', error);
    throw error;
  }
}
