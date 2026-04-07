import { AxiosError, AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import {
  DailyUsagePayload,
  SubscriptionOverview,
  SubscriptionPlansPayload,
  SubscriptionStatus,
  SubscriptionTier,
  UsageSnapshot,
} from '@/types';

type CacheEntry<T> = {
  fetchedAt: number;
  data: T;
};

const OVERVIEW_TTL_MS = 20_000;
const PLANS_TTL_MS = 60_000;
const USAGE_TTL_MS = 20_000;

let overviewCache: CacheEntry<SubscriptionOverview> | null = null;
let plansCache: CacheEntry<SubscriptionPlansPayload> | null = null;
let usageCache: CacheEntry<UsageSnapshot> | null = null;

let overviewInFlight: Promise<SubscriptionOverview> | null = null;
let plansInFlight: Promise<SubscriptionPlansPayload> | null = null;
let usageInFlight: Promise<UsageSnapshot> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null, ttlMs: number) {
  return Boolean(entry && Date.now() - entry.fetchedAt < ttlMs);
}

export function invalidateBillingCache() {
  overviewCache = null;
  plansCache = null;
  usageCache = null;
}

export async function getSubscriptionStatus() {
  try {
    const response: AxiosResponse<{ data: { subscription: SubscriptionStatus } }> = await apiClient.get(
      apiEndpoints.subscriptions.status,
    );
    return response.data.data.subscription;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getSubscriptionOverview(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && isFresh(overviewCache, OVERVIEW_TTL_MS)) {
    return overviewCache!.data;
  }
  if (!force && overviewInFlight) {
    return overviewInFlight;
  }

  overviewInFlight = (async () => {
    try {
      const response: AxiosResponse<{ data: SubscriptionOverview }> = await apiClient.get(
        apiEndpoints.subscriptions.status,
      );
      const data = response.data.data;
      overviewCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      throw mapApiError(error);
    } finally {
      overviewInFlight = null;
    }
  })();

  return overviewInFlight;
}

export async function getSubscriptionPlans(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && isFresh(plansCache, PLANS_TTL_MS)) {
    return plansCache!.data;
  }
  if (!force && plansInFlight) {
    return plansInFlight;
  }

  plansInFlight = (async () => {
    try {
      const response: AxiosResponse<{ data: SubscriptionPlansPayload }> = await apiClient.get(
        apiEndpoints.subscriptions.plans,
      );
      const data = response.data.data;
      plansCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      throw mapApiError(error);
    } finally {
      plansInFlight = null;
    }
  })();

  return plansInFlight;
}

export async function createCheckoutSession(
  tier: Exclude<SubscriptionTier, 'free'>,
  options?: {
    platform?: 'mobile';
    successUrl?: string;
    cancelUrl?: string;
  },
) {
  type CheckoutPayload = {
    tier: Exclude<SubscriptionTier, 'free'>;
    platform?: 'mobile';
    successUrl?: string;
    cancelUrl?: string;
  };

  try {
    const payload: CheckoutPayload = {
      tier,
      platform: options?.platform,
      successUrl: options?.successUrl,
      cancelUrl: options?.cancelUrl,
    };

    const response: AxiosResponse<{
      data: { url: string; sessionId?: string; successUrl?: string; cancelUrl?: string };
    }> = await apiClient.post(
      apiEndpoints.subscriptions.checkout,
      payload,
    );
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const responsePayload = error.response?.data as {
        error?: string;
        code?: string;
        message?: string;
        data?: { url?: string };
      } | undefined;
      const code = responsePayload?.code ?? responsePayload?.error;
      if (error.response?.status === 409 && code === 'MANAGE_EXISTING_SUBSCRIPTION' && responsePayload?.data?.url) {
        const managedError = new Error(responsePayload.message ?? 'Manage existing subscription in billing portal.') as Error & {
          code?: string;
          status?: number;
          redirectUrl?: string;
        };
        managedError.code = code;
        managedError.status = error.response.status;
        managedError.redirectUrl = responsePayload.data.url;
        throw managedError;
      }
    }
    throw mapApiError(error);
  }
}

export async function getDailyUsage(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && isFresh(usageCache, USAGE_TTL_MS)) {
    return usageCache!.data;
  }
  if (!force && usageInFlight) {
    return usageInFlight;
  }

  usageInFlight = (async () => {
    try {
      const response: AxiosResponse<{ data: DailyUsagePayload }> = await apiClient.get(
        apiEndpoints.users.usage,
      );
      const usage = response.data.data?.usage;
      const snapshot: UsageSnapshot = {
        chatUsed: usage?.chat?.used ?? 0,
        chatLimit: typeof usage?.chat?.limit === 'number' || usage?.chat?.limit === null
          ? usage.chat.limit
          : null,
        imageUsed: usage?.images?.used ?? 0,
        imageLimit: typeof usage?.images?.limit === 'number' || usage?.images?.limit === null
          ? usage.images.limit
          : null,
      };
      usageCache = { data: snapshot, fetchedAt: Date.now() };
      return snapshot;
    } catch (error) {
      throw mapApiError(error);
    } finally {
      usageInFlight = null;
    }
  })();

  return usageInFlight;
}

export async function createBillingPortalSession() {
  try {
    const response: AxiosResponse<{ data: { url: string } }> = await apiClient.post(
      apiEndpoints.subscriptions.portal,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
