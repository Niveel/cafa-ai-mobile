import type { RCCustomerInfo } from '@/types/revenuecat.types';
import type { SubscriptionTier } from '@/types';

const TIER_PRECEDENCE: Record<SubscriptionTier, number> = {
  cafa_max: 4,
  cafa_pro: 3,
  cafa_smart: 2,
  free: 1,
};

function resolveTierFromIdentifier(identifier: string | null | undefined): SubscriptionTier {
  const normalized = (identifier ?? '').trim().toLowerCase();
  if (!normalized) return 'free';
  if (normalized.includes('max')) return 'cafa_max';
  if (normalized.includes('pro')) return 'cafa_pro';
  if (normalized.includes('smart')) return 'cafa_smart';
  return 'free';
}

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
  const entitlementEntries = Object.entries(active ?? {});
  if (!entitlementEntries.length) return 'free';

  let highest: SubscriptionTier = 'free';
  for (const [entitlementId, entitlementInfo] of entitlementEntries) {
    const fromEntitlementId = resolveTierFromIdentifier(entitlementId);
    const fromProductIdentifier = resolveTierFromIdentifier(
      (entitlementInfo as { productIdentifier?: string } | undefined)?.productIdentifier,
    );
    highest = getHighestTier(highest, getHighestTier(fromEntitlementId, fromProductIdentifier));
  }

  return highest;
}

/**
 * Returns the expiration date of the highest active entitlement, if available.
 */
export function getActiveExpirationDate(customerInfo: RCCustomerInfo | null): Date | null {
  if (!customerInfo) return null;
  const active = customerInfo.entitlements.active;
  const entitlementEntries = Object.entries(active ?? {});
  if (!entitlementEntries.length) return null;

  let entitlement: { expirationDate?: string | null; productIdentifier?: string } | null = null;
  let highest: SubscriptionTier = 'free';
  for (const [entitlementId, entitlementInfo] of entitlementEntries) {
    const fromEntitlementId = resolveTierFromIdentifier(entitlementId);
    const fromProductIdentifier = resolveTierFromIdentifier(
      (entitlementInfo as { productIdentifier?: string } | undefined)?.productIdentifier,
    );
    const tier = getHighestTier(fromEntitlementId, fromProductIdentifier);
    if (TIER_PRECEDENCE[tier] >= TIER_PRECEDENCE[highest]) {
      highest = tier;
      entitlement = entitlementInfo as { expirationDate?: string | null; productIdentifier?: string };
    }
  }

  if (!entitlement?.expirationDate) return null;
  return new Date(entitlement.expirationDate);
}
