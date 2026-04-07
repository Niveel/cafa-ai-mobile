import { AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import { TranscriptionResult, VoiceDescriptor } from '@/types';

export async function getVoiceCatalog() {
  try {
    const response: AxiosResponse<{ data: VoiceDescriptor[] }> = await apiClient.get(apiEndpoints.voice.voices);
    return (response.data.data ?? []).filter((voice) => {
      const id = (voice.id ?? '').toLowerCase();
      const name = (voice.name ?? '').toLowerCase();
      return !id.includes('heart') && !name.includes('heart');
    });
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

export async function synthesizeVoice(payload: { text: string; voice?: string; speed?: number }) {
  const endpoint = `${API_BASE_URL}${apiEndpoints.voice.synthesize}`;
  const timeoutMs = 60_000;
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token for voice synthesis.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'audio/wav',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!response.ok) {
      const bodyText = await response.text();
      try {
        const parsed = JSON.parse(bodyText) as { message?: string; error?: string; code?: string };
        throw new Error(parsed.message || parsed.error || parsed.code || `Voice synth failed (${response.status}).`);
      } catch {
        throw new Error(bodyText || `Voice synth failed (${response.status}).`);
      }
    }

    if (!contentType.startsWith('audio/')) {
      const fallbackText = await response.text();
      throw new Error(
        `Unexpected voice response content-type: ${contentType || 'unknown'}${fallbackText ? ` (${fallbackText.slice(0, 140)})` : ''}`,
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Voice synthesis timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error instanceof Error ? error : mapApiError(error);
  } finally {
    clearTimeout(timeout);
  }
}
