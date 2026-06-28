import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import type {
  ApiResponse,
  CafaLifeHistoryPayload,
  CafaLifeTokenPayload,
} from '@/types';

export async function getCafaLifeToken() {
  try {
    const response: AxiosResponse<ApiResponse<CafaLifeTokenPayload>> = await apiClient.post(
      apiEndpoints.cafaLife.token,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getCafaLifeHistory() {
  try {
    const response: AxiosResponse<ApiResponse<CafaLifeHistoryPayload>> = await apiClient.get(
      apiEndpoints.cafaLife.history,
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
