import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { GenerateVideoRequest, VideoGenerationJob, VideoHistoryItem } from '@/types';

export async function startVideoGeneration(request: GenerateVideoRequest) {
  try {
    const response: AxiosResponse<{ data: VideoGenerationJob }> = await apiClient.post(apiEndpoints.videos.generate, request);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function pollVideoJob(jobId: string) {
  try {
    const response: AxiosResponse<{ data: VideoGenerationJob }> = await apiClient.get(apiEndpoints.videos.job(jobId));
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getVideoHistory() {
  try {
    const response: AxiosResponse<{ data: VideoHistoryItem[] }> = await apiClient.get(apiEndpoints.videos.history);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
