import { AxiosResponse } from 'axios';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';

export type CreditsStatus = {
  weekly: { used: number; total: number; resetAt: string | null };
  monthly: { used: number; total: number; resetAt: string | null };
  topupBalance: number;
  byFeature: { feature: string; credits: number; count: number }[];
};

export type CreditsPack = {
  id: 'small' | 'medium' | 'large';
  credits: number;
  priceUsd: number;
};

export type CreditsInvoice = {
  id: string;
  type: 'subscription' | 'topup';
  amount: number;
  currency: string;
  status: string;
  created: number;
  url: string | null;
};

type CacheEntry<T> = {
  fetchedAt: number;
  data: T;
};

const STATUS_TTL_MS = 15_000;
const PACKS_TTL_MS = 60_000;

let statusCache: CacheEntry<CreditsStatus> | null = null;
let packsCache: CacheEntry<CreditsPack[]> | null = null;

let statusInFlight: Promise<CreditsStatus> | null = null;
let packsInFlight: Promise<CreditsPack[]> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null, ttlMs: number) {
  return Boolean(entry && Date.now() - entry.fetchedAt < ttlMs);
}

export function invalidateCreditsCache() {
  statusCache = null;
  packsCache = null;
}

export async function getCreditsStatus(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && isFresh(statusCache, STATUS_TTL_MS)) {
    return statusCache!.data;
  }
  if (!force && statusInFlight) {
    return statusInFlight;
  }

  statusInFlight = (async () => {
    try {
      const response: AxiosResponse<{ data: CreditsStatus }> = await apiClient.get(apiEndpoints.credits.status);
      const data = response.data.data;
      statusCache = { data, fetchedAt: Date.now() };
      captureEvent(AnalyticsEvents.creditsStatusLoaded, { topupBalance: data.topupBalance });
      return data;
    } catch (error) {
      throw mapApiError(error);
    } finally {
      statusInFlight = null;
    }
  })();

  return statusInFlight;
}

export async function getCreditsPacks(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && isFresh(packsCache, PACKS_TTL_MS)) {
    return packsCache!.data;
  }
  if (!force && packsInFlight) {
    return packsInFlight;
  }

  packsInFlight = (async () => {
    try {
      const response: AxiosResponse<{ data: { packs: CreditsPack[] } }> = await apiClient.get(apiEndpoints.credits.packs);
      const data = response.data.data?.packs ?? [];
      packsCache = { data, fetchedAt: Date.now() };
      captureEvent(AnalyticsEvents.creditsPacksLoaded, { packsCount: data.length });
      return data;
    } catch (error) {
      throw mapApiError(error);
    } finally {
      packsInFlight = null;
    }
  })();

  return packsInFlight;
}

export async function createTopupPaymentIntent(input: { packId: 'small' | 'medium' | 'large' } | { customAmountUsd: number }) {
  try {
    captureEvent(AnalyticsEvents.creditsTopupStarted, input);
    const response: AxiosResponse<{ data: { clientSecret: string; amountUsd: number; credits: number } }> = await apiClient.post(
      apiEndpoints.credits.topupPaymentIntent,
      input,
    );
    const data = response.data.data;
    captureEvent(AnalyticsEvents.creditsTopupReady, { amountUsd: data.amountUsd, credits: data.credits });
    return data;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    captureEvent(AnalyticsEvents.creditsTopupFailed, { code: mapped.code ?? null, status: mapped.status ?? null });
    throw mapped;
  }
}

export async function getCreditsInvoices() {
  try {
    const response: AxiosResponse<{ data: { invoices: CreditsInvoice[] } }> = await apiClient.get(apiEndpoints.credits.invoices);
    return response.data.data?.invoices ?? [];
  } catch (error) {
    throw mapApiError(error);
  }
}
