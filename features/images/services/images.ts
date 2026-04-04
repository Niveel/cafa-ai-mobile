import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { GenerateImageRequest, ImageHistoryItem } from '@/types';

export async function generateImage(request: GenerateImageRequest) {
  try {
    const response: AxiosResponse<{ data: ImageHistoryItem }> = await apiClient.post(apiEndpoints.images.generate, request);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getImageHistory() {
  try {
    const response: AxiosResponse<{ data: ImageHistoryItem[] }> = await apiClient.get(apiEndpoints.images.history);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
