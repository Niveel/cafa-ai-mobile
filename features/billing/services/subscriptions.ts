import { AxiosError, AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/lib';
import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import {
  CanonicalSubscriptionTier,
  DailyUsagePayload,
  SubscriptionOverview,
  SubscriptionLifecycle,
  SubscriptionPlansPayload,
  SubscriptionStatus,
  SubscriptionSyncPayload,
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

export function mapSubscriptionTierToInternal(
  tier: SubscriptionTier | CanonicalSubscriptionTier | null | undefined,
): SubscriptionTier {
  const normalized = (tier ?? '').toString().trim().toLowerCase();
  if (normalized === 'cafa_max' || normalized === 'max') return 'cafa_max';
  if (normalized === 'cafa_pro' || normalized === 'pro') return 'cafa_pro';
  if (normalized === 'cafa_smart' || normalized === 'smart') return 'cafa_smart';
  return 'free';
}

export async function syncSubscriptionState(options?: { traceId?: string; reason?: string }) {
  try {
    const headers: Record<string, string> = {};
    if (options?.traceId) headers['x-cafa-trace-id'] = options.traceId;
    if (options?.reason) headers['x-cafa-trace-reason'] = options.reason;
    const response: AxiosResponse<{ data: SubscriptionSyncPayload }> = await apiClient.post(
      apiEndpoints.subscriptions.sync,
      {},
      { headers },
    );
    const data = response.data.data ?? {};
    const tier = mapSubscriptionTierToInternal(data.internal_tier ?? data.tier);
    const scheduledTier =
      data.scheduled_tier == null
        ? null
        : mapSubscriptionTierToInternal(data.scheduled_tier);

    invalidateBillingCache();
    captureEvent(AnalyticsEvents.subscriptionSyncCompleted, {
      tier,
      status: data.status ?? 'unknown',
      reason: options?.reason ?? null,
    });

    return {
      tier,
      status: data.status ?? 'unknown',
      productId: data.product_id ?? null,
      currentPeriodEnd: data.current_period_end ?? null,
      scheduledTier,
      scheduledChangeAt: data.scheduled_change_at ?? null,
      internalTier: data.internal_tier ? mapSubscriptionTierToInternal(data.internal_tier) : null,
      raw: data,
    };
  } catch (error) {
    throw mapApiError(error);
  }
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
      captureEvent(AnalyticsEvents.subscriptionPlansLoaded, {
        force,
        plansCount: (data as { plans?: unknown[] })?.plans?.length ?? null,
      });
      plansCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      const typed = error as AxiosError<{ message?: string; error?: string; code?: string }>;
      const status = typed.response?.status ?? 'unknown';
      const code = typed.response?.data?.code ?? typed.response?.data?.error ?? 'unknown';
      const message = typed.response?.data?.message ?? (typed.message || 'Unknown request error.');
      console.log(
        `[plans-fetch:error] endpoint=${API_BASE_URL}${apiEndpoints.subscriptions.plans} status=${status} code=${code} message="${message}" force=${force}`,
      );
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
    traceId?: string;
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
    captureEvent(AnalyticsEvents.subscriptionCheckoutStarted, {
      tier,
      platform: options?.platform ?? 'unknown',
    });
    const payload: CheckoutPayload = {
      tier,
      platform: options?.platform,
      successUrl: options?.successUrl,
      cancelUrl: options?.cancelUrl,
    };

    const headers: Record<string, string> = {};
    if (options?.traceId) headers['x-cafa-trace-id'] = options.traceId;
    headers['x-cafa-trace-reason'] = 'checkout';

    const response: AxiosResponse<{ data?: CheckoutResponseData }> = await apiClient.post(
      apiEndpoints.subscriptions.checkout,
      payload,
      { headers },
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

    captureEvent(AnalyticsEvents.subscriptionCheckoutReady, {
      mode: mode ?? null,
      requiresCheckout: isCheckoutStartedMode || (!isSubscriptionUpdatedMode && Boolean(resolvedUrl)),
      hasUrl: Boolean(resolvedUrl),
      tier,
    });
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
      const imagesUsage = (usage?.image ?? usage?.images) as Record<string, unknown> | undefined;
      const videosUsage = (usage?.video ?? usage?.videos) as Record<string, unknown> | undefined;
      const ttsUsage = usage?.tts as Record<string, unknown> | undefined;
      const chatUsed =
        asNumber(usage?.chat?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.chatMessagesThisMonth)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.chatMessagesToday)
        ?? 0;
      const imageUsed =
        asNumber(imagesUsage?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.imageGenerationsThisMonth)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.imageGenerationsToday)
        ?? 0;
      const aiDetectionWordsUsed =
        asNumber(usage?.aiDetectionWords?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.aiDetectionWordsUsed)
        ?? 0;
      const humanizeWordsUsed =
        asNumber(usage?.humanizeWords?.used)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.humanizeWordsUsed)
        ?? 0;
      const videoUsed =
        asNumber(videosUsage?.used)
        ??
        asNumber((usage as Record<string, unknown> | undefined)?.videoGenerationsThisMonth)
        ?? asNumber((usage as Record<string, unknown> | undefined)?.videoGenerationsToday)
        ?? 0;
      const ttsUsed = asNumber(ttsUsage?.used) ?? 0;
      const chatLimitRaw = usage?.chat?.limit;
      const imageLimitRaw = imagesUsage?.limit;
      const aiDetectionWordsLimitRaw = usage?.aiDetectionWords?.limit;
      const humanizeWordsLimitRaw = usage?.humanizeWords?.limit;
      const videoLimitRaw =
        asNumber((usage as Record<string, unknown> | undefined)?.videoLimit)
        ?? asNumber(videosUsage?.limit);
      const ttsLimitRaw = asNumber(ttsUsage?.limit);
      const snapshot: UsageSnapshot = {
        bucketDate: typeof usage?.bucketDate === 'string' ? usage.bucketDate : null,
        chatUsed,
        chatLimit:
          chatLimitRaw === null
            ? null
            : asNumber(chatLimitRaw) ?? asNumber((usage as Record<string, unknown> | undefined)?.chatLimit),
        imageUsed,
        imageLimit:
          imageLimitRaw === null
            ? null
            : asNumber(imageLimitRaw) ?? asNumber((usage as Record<string, unknown> | undefined)?.imageLimit),
        aiDetectionWordsUsed,
        aiDetectionWordsLimit:
          aiDetectionWordsLimitRaw === null
            ? null
            : asNumber(aiDetectionWordsLimitRaw) ?? asNumber((usage as Record<string, unknown> | undefined)?.aiDetectionWordsLimit),
        humanizeWordsUsed,
        humanizeWordsLimit:
          humanizeWordsLimitRaw === null
            ? null
            : asNumber(humanizeWordsLimitRaw) ?? asNumber((usage as Record<string, unknown> | undefined)?.humanizeWordsLimit),
        videoUsed,
        videoLimit: videoLimitRaw,
        ttsUsed,
        ttsLimit: ttsLimitRaw,
        maxUploadSizeMB: asNumber((usage as Record<string, unknown> | undefined)?.maxUploadSizeMB),
        maxPdfPages: asNumber((usage as Record<string, unknown> | undefined)?.maxPdfPages),
        maxDocxPages: asNumber((usage as Record<string, unknown> | undefined)?.maxDocxPages),
        maxPptxSlides: asNumber((usage as Record<string, unknown> | undefined)?.maxPptxSlides),
        docAnalysesUsed: asNumber((usage as Record<string, unknown> | undefined)?.docAnalysesUsed) ?? 0,
        docAnalysesPerMonth: asNumber((usage as Record<string, unknown> | undefined)?.docAnalysesPerMonth),
        exportsUsed: asNumber((usage as Record<string, unknown> | undefined)?.exportsUsed) ?? 0,
        exportsPerMonth: asNumber((usage as Record<string, unknown> | undefined)?.exportsPerMonth),
      };
      captureEvent(AnalyticsEvents.subscriptionUsageLoaded, {
        force,
        chatUsed,
        chatLimit: snapshot.chatLimit,
        imageUsed,
        imageLimit: snapshot.imageLimit,
        aiDetectionWordsUsed,
        aiDetectionWordsLimit: snapshot.aiDetectionWordsLimit,
        humanizeWordsUsed,
        humanizeWordsLimit: snapshot.humanizeWordsLimit,
        ttsUsed,
        ttsLimit: snapshot.ttsLimit,
      });
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
  traceId?: string;
}) {
  try {
    const payload = {
      platform: options?.platform,
      returnUrl: options?.returnUrl,
    };
    const headers: Record<string, string> = {};
    if (options?.traceId) headers['x-cafa-trace-id'] = options.traceId;
    headers['x-cafa-trace-reason'] = 'portal';
    const response: AxiosResponse<{ data: { url: string } }> = await apiClient.post(
      apiEndpoints.subscriptions.portal,
      payload,
      { headers },
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
