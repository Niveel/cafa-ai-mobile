import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { TranscriptionResult, VoiceDescriptor } from '@/types';

export async function getVoiceCatalog() {
  try {
    const response: AxiosResponse<{ data: VoiceDescriptor[] }> = await apiClient.get(apiEndpoints.voice.voices);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function transcribeAudio(file: Blob) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response: AxiosResponse<{ data: TranscriptionResult }> = await apiClient.post(
      apiEndpoints.voice.transcribe,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
