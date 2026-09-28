import { AxiosResponse } from 'axios';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';

export type DefaultPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null;

export async function getDefaultPaymentMethod() {
  try {
    const response: AxiosResponse<{ data: { paymentMethod: DefaultPaymentMethod } }> = await apiClient.get(
      apiEndpoints.subscriptions.paymentMethod,
    );
    const paymentMethod = response.data.data?.paymentMethod ?? null;
    captureEvent(AnalyticsEvents.paymentMethodLoaded, { hasPaymentMethod: Boolean(paymentMethod) });
    return paymentMethod;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function createPaymentMethodSetupIntent() {
  try {
    captureEvent(AnalyticsEvents.paymentMethodUpdateStarted);
    const response: AxiosResponse<{ data: { clientSecret: string } }> = await apiClient.post(
      apiEndpoints.subscriptions.paymentMethodSetupIntent,
      {},
    );
    return response.data.data;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    captureEvent(AnalyticsEvents.paymentMethodUpdateFailed, { code: mapped.code ?? null, status: mapped.status ?? null });
    throw mapped;
  }
}

export async function confirmPaymentMethodUpdate(setupIntentId: string) {
  try {
    const response: AxiosResponse<{ data: { updated: boolean } }> = await apiClient.post(
      apiEndpoints.subscriptions.paymentMethodConfirm,
      { setupIntentId },
    );
    captureEvent(AnalyticsEvents.paymentMethodUpdateSucceeded);
    return response.data.data;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    captureEvent(AnalyticsEvents.paymentMethodUpdateFailed, { code: mapped.code ?? null, status: mapped.status ?? null });
    throw mapped;
  }
}

export async function cancelSubscription() {
  try {
    captureEvent(AnalyticsEvents.subscriptionCancelRequested);
    const response: AxiosResponse<{ data: { willCancelAtPeriodEnd: boolean; scheduledCancelAt: string | null } }> = await apiClient.post(
      apiEndpoints.subscriptions.cancel,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function resumeSubscription() {
  try {
    captureEvent(AnalyticsEvents.subscriptionResumeRequested);
    const response: AxiosResponse<{ data: { willCancelAtPeriodEnd: boolean } }> = await apiClient.post(
      apiEndpoints.subscriptions.resume,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
