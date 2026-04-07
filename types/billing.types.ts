export type SubscriptionTier = 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max';

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  status: 'inactive' | 'active' | 'past_due' | 'canceled';
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
};

export type SubscriptionLifecycle = {
  willCancelAtPeriodEnd?: boolean;
  scheduledCancelAt?: string | null;
  canceledAt?: string | null;
};

export type SubscriptionLimits = {
  chatMessagesPerDay?: number | null;
  imageGenerationsPerDay?: number | null;
  videoGenerationsPerDay?: number | null;
  maxVideoDurationSeconds?: number | null;
  chatModel?: string;
  imageModel?: string;
  maxTokensPerRequest?: number;
  contextMessages?: number;
  documentsEnabled?: boolean;
};

export type SubscriptionUsage = {
  chatMessagesToday?: number;
  imageGenerationsToday?: number;
  videoGenerationsToday?: number;
  lastResetDate?: string;
};

export type SubscriptionOverview = {
  subscription: SubscriptionStatus;
  subscriptionLifecycle?: SubscriptionLifecycle;
  limits?: SubscriptionLimits;
  usage?: SubscriptionUsage;
};

export type SubscriptionPlan = {
  tier: SubscriptionTier;
  name: string;
  description?: string;
  benefits?: string[];
  recommended?: boolean;
  isActive?: boolean;
  price?: {
    amount: number;
    currency?: string;
    interval?: string;
    priceId?: string | null;
  };
  limits?: SubscriptionLimits;
};

export type SubscriptionPlansPayload = {
  currentTier: SubscriptionTier;
  plans: SubscriptionPlan[];
};

export type UsageSnapshot = {
  chatUsed: number;
  chatLimit: number | null;
  imageUsed: number;
  imageLimit: number | null;
};

export type DailyUsagePayload = {
  subscription?: {
    tier?: SubscriptionTier;
    status?: SubscriptionStatus['status'];
    renewalDate?: string | null;
  };
  usage?: {
    chat?: {
      used?: number;
      limit?: number | null;
    };
    images?: {
      used?: number;
      limit?: number | null;
    };
  };
};
