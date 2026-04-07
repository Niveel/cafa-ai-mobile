import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SubscriptionTier } from '@/types';

const BILLING_PENDING_TIER_KEY = 'cafa_ai_billing_pending_tier_v1';

export async function setPendingBillingTier(tier: Exclude<SubscriptionTier, 'free'>) {
  await AsyncStorage.setItem(BILLING_PENDING_TIER_KEY, tier);
}

export async function getPendingBillingTier() {
  const value = await AsyncStorage.getItem(BILLING_PENDING_TIER_KEY);
  if (value === 'cafa_smart' || value === 'cafa_pro' || value === 'cafa_max') {
    return value;
  }
  return null;
}

export async function clearPendingBillingTier() {
  await AsyncStorage.removeItem(BILLING_PENDING_TIER_KEY);
}

