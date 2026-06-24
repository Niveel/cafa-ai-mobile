export type SubscriptionTier = 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max';
export type CanonicalSubscriptionTier = 'free' | 'smart' | 'pro' | 'max';

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  status: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'failed' | 'unpaid';
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
  scheduledTier?: SubscriptionTier | null;
  scheduledChangeAt?: string | null;
  changeType?: 'upgrade' | 'downgrade' | 'cancel' | string | null;
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
  bucketDate?: string | null;
  chatUsed: number;
  chatLimit: number | null;
  imageUsed: number;
  imageLimit: number | null;
  videoUsed?: number;
  videoLimit?: number | null;
  aiDetectionWordsUsed?: number;
  aiDetectionWordsLimit?: number | null;
  humanizeWordsUsed?: number;
  humanizeWordsLimit?: number | null;
  maxUploadSizeMB?: number | null;
  maxPdfPages?: number | null;
  maxDocxPages?: number | null;
  maxPptxSlides?: number | null;
  docAnalysesUsed?: number;
  docAnalysesPerMonth?: number | null;
  exportsUsed?: number;
  exportsPerMonth?: number | null;
};

export type DailyUsagePayload = {
  subscription?: {
    tier?: SubscriptionTier;
    status?: SubscriptionStatus['status'];
    renewalDate?: string | null;
  };
  usage?: {
    bucketDate?: string;
    chatLimit?: number | null;
    imageLimit?: number | null;
    videoLimit?: number | null;
    maxUploadSizeMB?: number | null;
    maxPdfPages?: number | null;
    maxDocxPages?: number | null;
    maxPptxSlides?: number | null;
    docAnalysesPerMonth?: number | null;
    exportsPerMonth?: number | null;
    docAnalysesUsed?: number;
    exportsUsed?: number;
    videoGenerationsToday?: number;
    videoGenerationsThisMonth?: number;
    chat?: {
      used?: number;
      limit?: number | null;
    };
    images?: {
      used?: number;
      limit?: number | null;
    };
    videos?: {
      used?: number;
      limit?: number | null;
    };
    aiDetectionWords?: {
      used?: number;
      limit?: number | null;
    };
    humanizeWords?: {
      used?: number;
      limit?: number | null;
    };
  };
};

export type SubscriptionSyncPayload = {
  tier?: CanonicalSubscriptionTier | SubscriptionTier;
  status?: string;
  product_id?: string | null;
  current_period_end?: string | null;
  scheduled_tier?: CanonicalSubscriptionTier | SubscriptionTier | null;
  scheduled_change_at?: string | null;
  internal_tier?: SubscriptionTier | null;
};
