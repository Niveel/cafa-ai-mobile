import { SubscriptionTier } from './billing.types';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  tier: SubscriptionTier;
};
