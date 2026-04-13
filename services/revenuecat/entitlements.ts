import type { RCCustomerInfo } from '@/types/revenuecat.types';
import type { SubscriptionTier } from '@/types';

/** The RevenueCat entitlement identifiers configured in the RC dashboard */
export const ENTITLEMENT_MAX = 'cafa_max';
export const ENTITLEMENT_PRO = 'cafa_pro';
export const ENTITLEMENT_SMART = 'cafa_smart';

const TIER_PRECEDENCE: Record<SubscriptionTier, number> = {
  cafa_max: 4,
  cafa_pro: 3,
  cafa_smart: 2,
  free: 1,
};

/**
 * Compare two tiers and return the one with the highest precedence.
 */
export function getHighestTier(tierA: SubscriptionTier, tierB: SubscriptionTier): SubscriptionTier {
  return TIER_PRECEDENCE[tierA] >= TIER_PRECEDENCE[tierB] ? tierA : tierB;
}

/**
 * Check the RC CustomerInfo and resolve the highest active tier.
 * Returns 'free' if no active entitlement is found.
 */
export function resolveRCTier(customerInfo: RCCustomerInfo | null): SubscriptionTier {
  if (!customerInfo) return 'free';
  const active = customerInfo.entitlements.active;
  if (ENTITLEMENT_MAX in active) return 'cafa_max';
  if (ENTITLEMENT_PRO in active) return 'cafa_pro';
  if (ENTITLEMENT_SMART in active) return 'cafa_smart';
  return 'free';
}

/**
 * Returns the expiration date of the highest active entitlement, if available.
 */
export function getActiveExpirationDate(customerInfo: RCCustomerInfo | null): Date | null {
  if (!customerInfo) return null;
  const active = customerInfo.entitlements.active;
  let entitlement = null;
  if (ENTITLEMENT_MAX in active) entitlement = active[ENTITLEMENT_MAX];
  else if (ENTITLEMENT_PRO in active) entitlement = active[ENTITLEMENT_PRO];
  else if (ENTITLEMENT_SMART in active) entitlement = active[ENTITLEMENT_SMART];

  if (!entitlement?.expirationDate) return null;
  return new Date(entitlement.expirationDate);
}
