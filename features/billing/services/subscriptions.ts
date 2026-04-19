import { AxiosError, AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import {
  DailyUsagePayload,
  SubscriptionOverview,
  SubscriptionLifecycle,
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

function getNoCacheConfig(force: boolean) {
  if (!force) return undefined;
  return {
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    params: {
      _t: Date.now(),
    },
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

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
    const response: AxiosResponse<{ data: { subscription: SubscriptionStatus; subscriptionLifecycle?: SubscriptionLifecycle } }> = await apiClient.get(
      apiEndpoints.subscriptions.status,
    );
    return response.data.data;
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
        getNoCacheConfig(force),
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
        getNoCacheConfig(force),
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
  type CheckoutResponseData = {
    mode?: 'checkout_started' | 'subscription_updated' | string;
    returnStrategy?: 'redirect_to_app' | 'redirect_to_web' | string;
    url?: string;
    checkoutUrl?: string;
    checkout_url?: string;
    sessionUrl?: string;
    session_url?: string;
    sessionId?: string;
    successUrl?: string;
    cancelUrl?: string;
    success_url?: string;
    cancel_url?: string;
  };

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

    const response: AxiosResponse<{ data?: CheckoutResponseData }> = await apiClient.post(
      apiEndpoints.subscriptions.checkout,
      payload,
    );

    const raw = response.data?.data ?? {};
    const resolvedUrl =
      raw.url ??
      raw.checkoutUrl ??
      raw.checkout_url ??
      raw.sessionUrl ??
      raw.session_url;

    const mode = raw.mode;
    const isSubscriptionUpdatedMode = mode === 'subscription_updated';
    const isCheckoutStartedMode = mode === 'checkout_started';
    if (!resolvedUrl && isCheckoutStartedMode) {
      const contractError = new Error('Backend checkout response is missing URL for checkout_started mode.') as Error & {
        code?: string;
        status?: number;
      };
      contractError.code = 'CHECKOUT_URL_MISSING';
      contractError.status = response.status;
      throw contractError;
    }

    return {
      ...raw,
      mode,
      returnStrategy: raw.returnStrategy,
      url: resolvedUrl,
      successUrl: raw.successUrl ?? raw.success_url,
      cancelUrl: raw.cancelUrl ?? raw.cancel_url,
      requiresCheckout: isCheckoutStartedMode || (!isSubscriptionUpdatedMode && Boolean(resolvedUrl)),
    };
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
        getNoCacheConfig(force),
      );
      const usage = response.data.data?.usage as (DailyUsagePayload['usage'] & Record<string, unknown>) | undefined;
      const chatUsed =
        asNumber(usage?.chat?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.chatMessagesToday)
        ?? 0;
      const imageUsed =
        asNumber(usage?.images?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.imageGenerationsToday)
        ?? 0;
      const chatLimitRaw = usage?.chat?.limit;
      const imageLimitRaw = usage?.images?.limit;
      const snapshot: UsageSnapshot = {
        chatUsed,
        chatLimit: chatLimitRaw === null ? null : asNumber(chatLimitRaw),
        imageUsed,
        imageLimit: imageLimitRaw === null ? null : asNumber(imageLimitRaw),
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

export async function createBillingPortalSession(options?: {
  platform?: 'mobile';
  returnUrl?: string;
}) {
  try {
    const payload = {
      platform: options?.platform,
      returnUrl: options?.returnUrl,
    };
    const response: AxiosResponse<{ data: { url: string } }> = await apiClient.post(
      apiEndpoints.subscriptions.portal,
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
