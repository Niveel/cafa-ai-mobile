import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';

export type PersonalizationPayload = {
  tone?: 'balanced' | 'friendly' | 'direct';
  responseLength?: 'short' | 'medium' | 'long';
  memoryEnabled?: boolean;
};

export async function updatePersonalization(payload: PersonalizationPayload) {
  try {
    const response: AxiosResponse<{ data: PersonalizationPayload }> = await apiClient.patch(
      apiEndpoints.users.personalization,
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
