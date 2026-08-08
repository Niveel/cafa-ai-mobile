import { apiClient, apiEndpoints } from '@/services/api';

export type AdRewardKind = 'chat' | 'image' | 'video';

export const AD_REWARD_GRANTS = {
  chat: 10,
  image: 1,
  video: 1,
} as const satisfies Record<AdRewardKind, number>;

export type RewardEligibility = {
  eligible: boolean;
  rewardType: AdRewardKind;
  grantAmount: number;
  usedToday: number;
  remainingToday: number;
  dailyLimit: number;
  resetsAt: string;
  reason?: 'eligible' | 'daily_cap_reached' | 'paid_tier' | 'limit_not_reached' | string;
};

export type RewardSession = RewardEligibility & {
  sessionId: string;
  ssvUserId: string;
  ssvCustomData: string;
  expiresAt: string;
};

export type RewardGrant = {
  sessionId: string;
  status: 'granted' | 'pending_verification' | 'already_granted';
  rewardType: AdRewardKind;
  grantAmount: number;
  remainingToday: number;
  dailyLimit: number;
  usage?: Record<string, unknown>;
};

export async function getRewardEligibility(rewardType: AdRewardKind): Promise<RewardEligibility> {
  const response = await apiClient.get<RewardEligibility>(apiEndpoints.ads.rewardEligibility, {
    params: { rewardType },
  });
  return response.data;
}

export async function createRewardSession(rewardType: AdRewardKind): Promise<RewardSession> {
  const response = await apiClient.post<RewardSession>(apiEndpoints.ads.rewardSessions, {
    rewardType,
    placement: 'limit_notice',
    requestedGrant: AD_REWARD_GRANTS[rewardType],
  });
  return response.data;
}

export async function claimRewardSession(
  sessionId: string,
  adReward: { type: string; amount: number },
): Promise<RewardGrant> {
  const response = await apiClient.post<RewardGrant>(apiEndpoints.ads.rewardClaim(sessionId), {
    completionSource: 'google_mobile_ads_client_event',
    adReward,
  });
  return response.data;
}
