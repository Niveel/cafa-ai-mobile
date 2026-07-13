import { AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import type {
  ApiResponse,
  AvatarClonedVoice,
  AvatarGalleryItem,
  AvatarGalleryQuery,
  AvatarHistoryItem,
  AvatarHistoryPage,
  AvatarScriptGenerationRequest,
  AvatarScriptGenerationResult,
  AvatarVideoGenerationJob,
  AvatarVideoGenerationRequest,
  AvatarVideoStatus,
  AvatarVoiceCatalog,
  AvatarVoiceQuery,
} from '@/types';

type AvatarGalleryResponse = ApiResponse<{ avatars?: AvatarGalleryItem[] }>;
type AvatarUploadResponse = ApiResponse<{ imageUrl?: string }>;
type AvatarVoiceLibraryResponse = ApiResponse<{ voices?: AvatarVoiceCatalog['voices']; total?: number; categories?: string[] }>;
type AvatarVoiceClonesResponse = ApiResponse<{ clones?: AvatarClonedVoice[] }>;
type AvatarVoiceCloneResponse = ApiResponse<AvatarClonedVoice>;
type AvatarScriptResponse = ApiResponse<AvatarScriptGenerationResult>;
type AvatarVideoGenerateResponse = ApiResponse<AvatarVideoGenerationJob>;
type AvatarVideoStatusResponse = ApiResponse<AvatarVideoStatus>;
type AvatarHistoryResponse =
  | ApiResponse<{ videos?: AvatarHistoryItem[]; pagination?: AvatarHistoryPage['pagination'] }>
  | { data?: { videos?: AvatarHistoryItem[]; pagination?: AvatarHistoryPage['pagination'] } };

type AvatarRequestOptions = {
  forceRefresh?: boolean;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

const GALLERY_CACHE_TTL_MS = 30 * 60 * 1000;
const VOICE_CACHE_TTL_MS = 30 * 60 * 1000;
const CLONES_CACHE_TTL_MS = 10 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 2 * 60 * 1000;

const avatarGalleryCache = new Map<string, CachedValue<AvatarGalleryItem[]>>();
const avatarVoiceCache = new Map<string, CachedValue<AvatarVoiceCatalog>>();
const avatarHistoryCache = new Map<string, CachedValue<AvatarHistoryPage>>();
let avatarClonesCache: CachedValue<AvatarClonedVoice[]> | null = null;

function logAvatarDev(label: string, payload: unknown) {
  if (!__DEV__) return;
  console.log(label, payload);
}

function readCache<T>(entry: CachedValue<T> | null | undefined) {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value;
}

function writeCache<T>(value: T, ttlMs: number): CachedValue<T> {
  return {
    value,
    expiresAt: Date.now() + ttlMs,
  };
}

function sanitizeAvatarGalleryQuery(query: AvatarGalleryQuery): Record<string, unknown> {
  return {
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.style ? { style: query.style } : {}),
    ...(typeof query.limit === 'number' ? { limit: query.limit } : {}),
  };
}

function sanitizeAvatarVoiceQuery(query: AvatarVoiceQuery): Record<string, unknown> {
  return {
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(typeof query.popular === 'boolean' ? { popular: query.popular } : {}),
  };
}

function normalizeAvatarHistory(payload: AvatarHistoryResponse, page = 1, limit = 20): AvatarHistoryPage {
  const source = 'data' in payload ? payload.data : undefined;
  const videos = source?.videos ?? [];
  const pagination = source?.pagination;
  return {
    videos,
    pagination: {
      page: pagination?.page ?? page,
      limit: pagination?.limit ?? limit,
      total: pagination?.total ?? videos.length,
      pages: pagination?.pages ?? Math.max(1, Math.ceil((pagination?.total ?? videos.length) / Math.max(1, pagination?.limit ?? limit))),
    },
  };
}

export async function getAvatarGallery(query: AvatarGalleryQuery = {}, options: AvatarRequestOptions = {}) {
  const sanitizedQuery = sanitizeAvatarGalleryQuery(query);
  const cacheKey = JSON.stringify(sanitizedQuery);
  if (!options.forceRefresh) {
    const cached = readCache(avatarGalleryCache.get(cacheKey));
    if (cached) {
      logAvatarDev('[avatar-gallery:cache-hit]', {
        endpoint: apiEndpoints.avatar.gallery,
        query: sanitizedQuery,
        count: cached.length,
      });
      return cached;
    }
  }
  try {
    logAvatarDev('[avatar-gallery:request]', {
      endpoint: apiEndpoints.avatar.gallery,
      query: sanitizedQuery,
    });
    const response: AxiosResponse<AvatarGalleryResponse> = await apiClient.get(apiEndpoints.avatar.gallery, {
      params: sanitizedQuery,
    });
    const avatars = response.data?.data?.avatars ?? [];
    avatarGalleryCache.set(cacheKey, writeCache(avatars, GALLERY_CACHE_TTL_MS));
    logAvatarDev('[avatar-gallery:response]', {
      endpoint: apiEndpoints.avatar.gallery,
      query: sanitizedQuery,
      count: avatars.length,
      data: response.data,
    });
    return avatars;
  } catch (error) {
    const mapped = mapApiError(error);
    logAvatarDev('[avatar-gallery:error]', {
      endpoint: apiEndpoints.avatar.gallery,
      query: sanitizedQuery,
      ...(mapped as Error & { code?: string; status?: number; details?: unknown; payload?: unknown }),
    });
    throw mapped;
  }
}

export async function uploadAvatarImage(image: { uri: string; fileName?: string; mimeType?: string }) {
  const formData = new FormData();
  const normalizedName = image.fileName?.trim() || `avatar-${Date.now()}.jpg`;
  const normalizedType = image.mimeType?.trim() || 'image/jpeg';
  const imageFile = {
    uri: image.uri,
    name: normalizedName,
    type: normalizedType,
  } as unknown as { uri: string; name: string; type: string };
  formData.append('image', imageFile as never);

  try {
    logAvatarDev('[avatar-upload:request]', {
      endpoint: apiEndpoints.avatar.upload,
      fileName: normalizedName,
      mimeType: normalizedType,
    });
    const response: AxiosResponse<AvatarUploadResponse> = await apiClient.post(
      apiEndpoints.avatar.upload,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    const imageUrl = response.data?.data?.imageUrl;
    logAvatarDev('[avatar-upload:response]', {
      endpoint: apiEndpoints.avatar.upload,
      imageUrl,
      data: response.data,
    });
    if (!imageUrl) {
      throw new Error('Upload completed, but no image URL was returned.');
    }
    return imageUrl;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getAvatarVoiceCatalog(query: AvatarVoiceQuery = {}, options: AvatarRequestOptions = {}): Promise<AvatarVoiceCatalog> {
  const sanitizedQuery = sanitizeAvatarVoiceQuery(query);
  const cacheKey = JSON.stringify(sanitizedQuery);
  if (!options.forceRefresh) {
    const cached = readCache(avatarVoiceCache.get(cacheKey));
    if (cached) {
      logAvatarDev('[avatar-voices:cache-hit]', {
        endpoint: apiEndpoints.avatar.voices,
        query: sanitizedQuery,
        total: cached.total,
        voicesReturned: cached.voices.length,
      });
      return cached;
    }
  }
  try {
    logAvatarDev('[avatar-voices:request]', {
      endpoint: apiEndpoints.avatar.voices,
      query: sanitizedQuery,
    });
    const response: AxiosResponse<AvatarVoiceLibraryResponse> = await apiClient.get(apiEndpoints.avatar.voices, {
      params: sanitizedQuery,
    });
    const result = {
      voices: response.data?.data?.voices ?? [],
      total: response.data?.data?.total ?? null,
      categories: response.data?.data?.categories ?? [],
      defaultVoice: null,
    };
    avatarVoiceCache.set(cacheKey, writeCache(result, VOICE_CACHE_TTL_MS));
    logAvatarDev('[avatar-voices:response]', {
      endpoint: apiEndpoints.avatar.voices,
      query: sanitizedQuery,
      total: result.total,
      voicesReturned: result.voices.length,
      data: response.data,
    });
    return result;
  } catch (error) {
    const mapped = mapApiError(error);
    logAvatarDev('[avatar-voices:error]', {
      endpoint: apiEndpoints.avatar.voices,
      query: sanitizedQuery,
      ...(mapped as Error & { code?: string; status?: number; details?: unknown; payload?: unknown }),
    });
    throw mapped;
  }
}

export async function getAvatarVoiceClones(options: AvatarRequestOptions = {}) {
  if (!options.forceRefresh) {
    const cached = readCache(avatarClonesCache);
    if (cached) {
      logAvatarDev('[avatar-voice-clones:cache-hit]', {
        endpoint: apiEndpoints.avatar.voiceClones,
        count: cached.length,
      });
      return cached;
    }
  }
  try {
    const response: AxiosResponse<AvatarVoiceClonesResponse> = await apiClient.get(apiEndpoints.avatar.voiceClones);
    const clones = response.data?.data?.clones ?? [];
    avatarClonesCache = writeCache(clones, CLONES_CACHE_TTL_MS);
    logAvatarDev('[avatar-voice-clones:response]', {
      endpoint: apiEndpoints.avatar.voiceClones,
      count: clones.length,
      data: response.data,
    });
    return clones;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function cloneAvatarVoice(payload: { audio: { uri: string; fileName?: string; mimeType?: string }; name: string }) {
  const formData = new FormData();
  const normalizedName = payload.audio.fileName?.trim() || `voice-clone-${Date.now()}.m4a`;
  const normalizedType = payload.audio.mimeType?.trim() || 'audio/m4a';
  const audioFile = {
    uri: payload.audio.uri,
    name: normalizedName,
    type: normalizedType,
  } as unknown as { uri: string; name: string; type: string };
  formData.append('audio', audioFile as never);
  formData.append('name', payload.name.trim());

  try {
    logAvatarDev('[avatar-voice-clone:request]', {
      endpoint: apiEndpoints.avatar.voiceClone,
      name: payload.name.trim(),
      fileName: normalizedName,
      mimeType: normalizedType,
    });
    const response: AxiosResponse<AvatarVoiceCloneResponse> = await apiClient.post(
      apiEndpoints.avatar.voiceClone,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    const clone = response.data?.data;
    logAvatarDev('[avatar-voice-clone:response]', {
      endpoint: apiEndpoints.avatar.voiceClone,
      data: response.data,
    });
    avatarClonesCache = null;
    if (!clone?.fishAudioId?.trim()) {
      throw new Error('Voice cloning completed, but no fishAudioId was returned.');
    }
    return clone;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function previewAvatarVoice(payload: { voiceId?: string; fishAudioId?: string }) {
  const endpoint = `${API_BASE_URL}${apiEndpoints.avatar.voicePreview}`;
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token for voice preview.');
  }
  if (!payload.voiceId?.trim() && !payload.fishAudioId?.trim()) {
    throw new Error('A voice ID or cloned voice ID is required for preview.');
  }

  logAvatarDev('[avatar-voice-preview:request]', {
    endpoint,
    payload,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload.voiceId?.trim() ? { voiceId: payload.voiceId.trim() } : { fishAudioId: payload.fishAudioId?.trim() }),
  });

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  logAvatarDev('[avatar-voice-preview:response-meta]', {
    endpoint,
    status: response.status,
    ok: response.ok,
    contentType,
  });
  if (!response.ok) {
    const fallbackText = await response.text();
    throw new Error(fallbackText || `Voice preview failed (${response.status}).`);
  }
  if (!contentType.startsWith('audio/')) {
    const fallbackText = await response.text();
    throw new Error(
      `Unexpected voice preview response content-type: ${contentType || 'unknown'}${fallbackText ? ` (${fallbackText.slice(0, 140)})` : ''}`,
    );
  }

  const buffer = await response.arrayBuffer();
  logAvatarDev('[avatar-voice-preview:response-bytes]', {
    endpoint,
    byteLength: buffer.byteLength,
  });
  return new Uint8Array(buffer);
}

export async function generateAvatarScript(payload: AvatarScriptGenerationRequest) {
  try {
    logAvatarDev('[avatar-script:request]', {
      endpoint: apiEndpoints.avatar.scriptGenerate,
      payload,
    });
    const response: AxiosResponse<AvatarScriptResponse> = await apiClient.post(
      apiEndpoints.avatar.scriptGenerate,
      payload,
    );
    const result = response.data?.data;
    logAvatarDev('[avatar-script:response]', {
      endpoint: apiEndpoints.avatar.scriptGenerate,
      data: response.data,
    });
    if (!result?.script?.trim()) {
      throw new Error('Script generation completed, but no script was returned.');
    }
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function generateAvatarVideo(payload: AvatarVideoGenerationRequest) {
  try {
    logAvatarDev('[avatar-video-generate:request]', {
      endpoint: apiEndpoints.avatar.videoGenerate,
      payload,
    });
    const response: AxiosResponse<AvatarVideoGenerateResponse> = await apiClient.post(
      apiEndpoints.avatar.videoGenerate,
      payload,
    );
    const result = response.data?.data;
    logAvatarDev('[avatar-video-generate:response]', {
      endpoint: apiEndpoints.avatar.videoGenerate,
      data: response.data,
    });
    if (!result?.id?.trim()) {
      throw new Error('Avatar generation started, but no job ID was returned.');
    }
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getAvatarVideoStatus(jobId: string) {
  try {
    const response: AxiosResponse<AvatarVideoStatusResponse> = await apiClient.get(
      apiEndpoints.avatar.videoStatus(jobId),
    );
    const result = response.data?.data;
    if (!result?.id?.trim()) {
      throw new Error('Avatar status polling returned an unexpected response.');
    }
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function cancelAvatarVideo(jobId: string) {
  try {
    await apiClient.post(apiEndpoints.avatar.videoCancel(jobId));
    avatarHistoryCache.clear();
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteAvatarVideo(videoId: string) {
  try {
    await apiClient.delete(apiEndpoints.avatar.videoDelete(videoId));
    avatarHistoryCache.clear();
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getAvatarHistory(page = 1, limit = 20, options: AvatarRequestOptions = {}) {
  const cacheKey = `${page}:${limit}`;
  if (!options.forceRefresh) {
    const cached = readCache(avatarHistoryCache.get(cacheKey));
    if (cached) {
      logAvatarDev('[avatar-history:cache-hit]', {
        endpoint: apiEndpoints.avatar.history,
        page,
        limit,
        videosReturned: cached.videos.length,
        pagination: cached.pagination,
      });
      return cached;
    }
  }
  try {
    const response: AxiosResponse<AvatarHistoryResponse> = await apiClient.get(apiEndpoints.avatar.history, {
      params: { page, limit },
    });
    const result = normalizeAvatarHistory(response.data, page, limit);
    avatarHistoryCache.set(cacheKey, writeCache(result, HISTORY_CACHE_TTL_MS));
    logAvatarDev('[avatar-history:response]', {
      endpoint: apiEndpoints.avatar.history,
      page,
      limit,
      videosReturned: result.videos.length,
      pagination: result.pagination,
      data: response.data,
    });
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}
