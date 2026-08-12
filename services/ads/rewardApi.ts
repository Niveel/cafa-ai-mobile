import type { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints } from '@/services/api';
import type { ApiResponse } from '@/types';

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

function unwrapRewardPayload<T>(response: AxiosResponse<T | ApiResponse<T>>): T {
  const body = response.data as T | ApiResponse<T>;
  if (body && typeof body === 'object' && 'data' in body) {
    const nested = (body as ApiResponse<T>).data;
    if (nested) return nested;
  }
  return body as T;
}

export async function getRewardEligibility(rewardType: AdRewardKind): Promise<RewardEligibility> {
  const response = await apiClient.get<RewardEligibility>(apiEndpoints.ads.rewardEligibility, {
    params: { rewardType },
  });
  return unwrapRewardPayload(response);
}

export async function createRewardSession(rewardType: AdRewardKind): Promise<RewardSession> {
  if (__DEV__) console.log('[ads:reward-session:request]', { endpoint: apiEndpoints.ads.rewardSessions, rewardType });
  const response = await apiClient.post<RewardSession | ApiResponse<RewardSession>>(apiEndpoints.ads.rewardSessions, {
    rewardType,
    placement: 'limit_notice',
    requestedGrant: AD_REWARD_GRANTS[rewardType],
  });
  const session = unwrapRewardPayload(response);
  if (__DEV__) console.log('[ads:reward-session:response]', {
    endpoint: apiEndpoints.ads.rewardSessions,
    status: response.status,
    eligible: session.eligible,
    reason: session.reason ?? null,
    sessionId: session.sessionId ?? null,
    remainingToday: session.remainingToday,
  });
  return session;
}

export async function claimRewardSession(
  sessionId: string,
  adReward: { type: string; amount: number },
): Promise<RewardGrant> {
  const endpoint = apiEndpoints.ads.rewardClaim(sessionId);
  if (__DEV__) console.log('[ads:reward-claim:request]', { endpoint, sessionId });
  const response = await apiClient.post<RewardGrant | ApiResponse<RewardGrant>>(endpoint, {
    completionSource: 'google_mobile_ads_client_event',
    adReward,
  });
  const grant = unwrapRewardPayload(response);
  if (__DEV__) console.log('[ads:reward-claim:response]', {
    endpoint,
    status: response.status,
    sessionId,
    grantStatus: grant.status,
    grantAmount: grant.grantAmount,
  });
  return grant;
}
