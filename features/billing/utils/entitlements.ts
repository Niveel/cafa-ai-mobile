import { SubscriptionTier } from '@/types';

export function canGenerateImages(tier: SubscriptionTier) {
  return tier !== 'free';
}

export function canUseDocuments(tier: SubscriptionTier) {
  return tier === 'cafa_pro' || tier === 'cafa_max';
}
