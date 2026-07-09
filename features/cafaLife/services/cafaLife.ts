import { AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import type {
  ApiResponse,
  CafaLifeHistoryPayload,
  CafaLifeTokenPayload,
  CafaLifeVoicesPayload,
} from '@/types';

const VOICES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let voicesCache: { payload: CafaLifeVoicesPayload; fetchedAt: number } | null = null;

function logCafaLifeDev(label: string, payload: unknown) {
  if (!__DEV__) return;
  console.log(label, payload);
}

function createFriendlyVoicePreviewError(response: Response, payload?: { message?: string; error?: string; code?: string }) {
  const message = payload?.message || payload?.error || payload?.code || '';

  if (response.status === 401) {
    return new Error('Please log in again to preview voices.');
  }

  if (/not found|invalid voice|unsupported/i.test(message)) {
    return new Error('That voice preview is not available right now. Please choose another voice.');
  }

  if (/network|fetch|timeout|temporar/i.test(message)) {
    return new Error('Voice preview is unavailable right now. Please try again in a moment.');
  }

  return new Error('Could not play the voice preview right now. Please try again.');
}

export async function getCafaLifeToken(voice?: string) {
  try {
    const response: AxiosResponse<ApiResponse<CafaLifeTokenPayload>> = await apiClient.post(
      apiEndpoints.cafaLife.token,
      voice?.trim() ? { voice: voice.trim() } : {},
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

export async function getCafaLifeVoices(options?: { forceRefresh?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;
  if (!forceRefresh && voicesCache && Date.now() - voicesCache.fetchedAt < VOICES_CACHE_TTL_MS) {
    return voicesCache.payload;
  }

  try {
    const response: AxiosResponse<ApiResponse<CafaLifeVoicesPayload>> = await apiClient.get(
      apiEndpoints.cafaLife.voices,
    );
    const payload = response.data.data;
    voicesCache = {
      payload,
      fetchedAt: Date.now(),
    };
    return payload;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function previewCafaLifeVoice(voice: string) {
  const trimmedVoice = voice.trim();
  if (!trimmedVoice) {
    throw new Error('Choose a voice before previewing it.');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Please log in again to preview voices.');
  }

  const endpoint = `${API_BASE_URL}${apiEndpoints.cafaLife.voicePreview}`;
  logCafaLifeDev('[cafa-life:voice-preview:request]', {
    endpoint,
    voice: trimmedVoice,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ voice: trimmedVoice }),
  });

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  logCafaLifeDev('[cafa-life:voice-preview:response-meta]', {
    endpoint,
    status: response.status,
    ok: response.ok,
    contentType,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    let parsedPayload: { message?: string; error?: string; code?: string } | undefined;

    try {
      parsedPayload = JSON.parse(bodyText) as { message?: string; error?: string; code?: string };
    } catch {
      parsedPayload = undefined;
    }

    logCafaLifeDev('[cafa-life:voice-preview:error-response]', {
      endpoint,
      status: response.status,
      contentType,
      bodyText,
      payload: parsedPayload,
    });

    if (parsedPayload) {
      throw createFriendlyVoicePreviewError(response, parsedPayload);
    }

    if (bodyText) {
      throw createFriendlyVoicePreviewError(response, { message: bodyText });
    }

    throw new Error('Could not play the voice preview right now. Please try again.');
  }

  if (!contentType.startsWith('audio/')) {
    const fallbackText = await response.text();
    logCafaLifeDev('[cafa-life:voice-preview:unexpected-response]', {
      endpoint,
      status: response.status,
      contentType,
      bodyText: fallbackText,
    });
    throw new Error('Could not play the voice preview right now. Please try again.');
  }

  const buffer = await response.arrayBuffer();
  logCafaLifeDev('[cafa-life:voice-preview:response-bytes]', {
    endpoint,
    byteLength: buffer.byteLength,
  });
  return new Uint8Array(buffer);
}
