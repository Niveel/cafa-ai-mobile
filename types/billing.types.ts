export type SubscriptionTier = 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max';

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  status: 'inactive' | 'active' | 'past_due' | 'canceled';
  currentPeriodEnd?: string | null;
};

export type UsageSnapshot = {
  chatUsed: number;
  chatLimit: number | null;
  imageUsed: number;
  imageLimit: number | null;
};
