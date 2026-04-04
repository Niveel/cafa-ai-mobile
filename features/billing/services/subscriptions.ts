import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { SubscriptionStatus } from '@/types';

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
