import { AxiosError, AxiosResponse } from 'axios';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { GenerateVideoRequest, VideoGenerationJob, VideoHistoryItem, VideoHistoryPage, VideoHistoryQuery } from '@/types';

const VIDEO_HISTORY_MIN_REQUEST_GAP_MS = 1200;
const VIDEO_HISTORY_RATE_LIMIT_BACKOFF_MS = 12000;
const VIDEO_HISTORY_CACHE_TTL_MS = 10000;

let videoHistoryInFlightPromise: Promise<VideoHistoryPage> | null = null;
let videoHistoryLastRequestedAt = 0;
let videoHistoryRateLimitedUntil = 0;
let videoHistoryLastSuccess: { value: VideoHistoryPage; at: number } | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ApiMappedError = Error & {
  code?: string;
  status?: number;
};

type VideoJobResponseShape = {
  data?: unknown;
  job?: unknown;
  jobId?: string;
  status?: string;
  message?: string;
  error?: string;
  videoUrl?: string;
  result?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeVideoJobPayload(payload: unknown): VideoGenerationJob | null {
  if (!isObject(payload)) return null;
  if (isObject(payload.data)) return normalizeVideoJobPayload(payload.data);
  if (isObject(payload.job)) return normalizeVideoJobPayload(payload.job);

  const candidate = payload as VideoJobResponseShape;
  if (!candidate.jobId && !candidate.status && !candidate.videoUrl && !candidate.result && !candidate.error) {
    return null;
  }
  return candidate as unknown as VideoGenerationJob;
}

function createVideoPayloadError(message: string): ApiMappedError {
  const error = new Error(message) as ApiMappedError;
  error.code = 'VIDEO_JOB_INVALID_RESPONSE';
  error.status = 200;
  return error;
}

function createVideoTransportError(message: string, code: string, status?: number): ApiMappedError {
  const error = new Error(message) as ApiMappedError;
  error.code = code;
  error.status = status;
  return error;
}

async function assertReadableUploadUri(uri: string) {
  if (!uri?.trim()) {
    throw createVideoTransportError('Image upload URI is missing.', 'VIDEO_FROM_IMAGE_INVALID_URI', 0);
  }
  if (!uri.startsWith('file://')) return;

  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw createVideoTransportError('Selected image is no longer available on device storage.', 'VIDEO_FROM_IMAGE_FILE_MISSING', 0);
    }
  } catch (error) {
    if ((error as ApiMappedError)?.code) throw error;
    throw createVideoTransportError('Could not read selected image from local storage.', 'VIDEO_FROM_IMAGE_FILE_UNREADABLE', 0);
  }
}

function isLikelyTransportNetworkError(error: unknown) {
  if (!(error instanceof AxiosError)) return false;
  if (error.response) return false;
  const message = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  return (
    message.includes('network error')
    || message.includes('socket')
    || message.includes('timeout')
    || code.includes('network')
    || code.includes('timeout')
    || code.includes('conn')
  );
}

export async function startVideoGeneration(request: GenerateVideoRequest) {
  try {
    const response: AxiosResponse<VideoJobResponseShape> = await apiClient.post(apiEndpoints.videos.generate, request);
    const normalized = normalizeVideoJobPayload(response.data);
    if (!normalized?.jobId) {
      throw createVideoPayloadError('Video generation started, but no job ID was returned.');
    }
    return normalized;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function startVideoGenerationFromImage(request: {
  conversationId?: string;
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: number;
  image: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  };
}) {
  await assertReadableUploadUri(request.image.uri);

  const formData = new FormData();
  formData.append('prompt', request.prompt);
  if (request.conversationId) formData.append('conversationId', request.conversationId);
  if (request.aspectRatio) formData.append('aspectRatio', request.aspectRatio);
  if (typeof request.durationSeconds === 'number') formData.append('durationSeconds', String(request.durationSeconds));

  const imageUri = request.image.uri;
  const normalizedName = request.image.fileName ?? `image-${Date.now()}.jpg`;
  const normalizedType = request.image.mimeType ?? 'image/jpeg';
  const imageFile = {
    uri: imageUri,
    name: normalizedName,
    type: normalizedType,
  } as unknown as { uri: string; name: string; type: string };
  formData.append('image', imageFile as never);
  formData.append('files', imageFile as never);

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response: AxiosResponse<VideoJobResponseShape> = await apiClient.post(
        apiEndpoints.videos.fromImage,
        formData,
        {
          timeout: 120_000,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      const normalized = normalizeVideoJobPayload(response.data);
      if (!normalized?.jobId) {
        throw createVideoPayloadError('Image-to-video started, but no job ID was returned.');
      }
      return normalized;
    } catch (error) {
      if (attempt < maxAttempts && isLikelyTransportNetworkError(error)) {
        await sleep(900);
        continue;
      }
      throw mapApiError(error);
    }
  }

  throw createVideoTransportError('Could not start image-to-video upload due to network transport failure.', 'VIDEO_FROM_IMAGE_NETWORK_ERROR', 0);
}

export async function pollVideoJob(jobId: string) {
  try {
    const response: AxiosResponse<VideoJobResponseShape> = await apiClient.get(apiEndpoints.videos.job(jobId));
    const normalized = normalizeVideoJobPayload(response.data);
    if (!normalized) {
      throw createVideoPayloadError('Video job poll returned an unexpected response shape.');
    }
    return normalized;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getVideoHistory() {
  const page = await getVideoHistoryPage({ page: 1, limit: 20 });
  return page.videos;
}

type VideoHistoryResponse =
  | { data: VideoHistoryItem[] }
  | {
      data: {
        videos?: VideoHistoryItem[];
        pagination?: {
          page?: number;
          limit?: number;
          total?: number;
          pages?: number;
          hasNextPage?: boolean;
          nextCursor?: string | null;
        };
      };
    };

function normalizeVideoHistory(response: VideoHistoryResponse, query: VideoHistoryQuery = {}): VideoHistoryPage {
  const payload = response.data;
  if (Array.isArray(payload)) {
    const page = query.page ?? 1;
    const limit = query.limit ?? (payload.length || 20);
    return {
      videos: payload,
      pagination: {
        page,
        limit,
        total: payload.length,
        pages: 1,
        hasNextPage: false,
        nextCursor: null,
      },
    };
  }

  const videos = payload.videos ?? [];
  const pagination = payload.pagination;
  const page = pagination?.page ?? query.page ?? 1;
  const limit = pagination?.limit ?? query.limit ?? (videos.length || 20);
  const total = pagination?.total ?? videos.length;
  const pages = pagination?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const hasNextPage = pagination?.hasNextPage ?? page < pages;

  return {
    videos,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage,
      nextCursor: pagination?.nextCursor ?? null,
    },
  };
}

export async function getVideoHistoryPage(
  query: VideoHistoryQuery = {},
  options?: { force?: boolean },
): Promise<VideoHistoryPage> {
  const force = Boolean(options?.force);
  const isFirstPage = (query.page ?? 1) === 1 && !query.cursor;
  const now = Date.now();

  if (!force && isFirstPage && videoHistoryLastSuccess && now - videoHistoryLastSuccess.at < VIDEO_HISTORY_CACHE_TTL_MS) {
    return videoHistoryLastSuccess.value;
  }

  if (!force && now < videoHistoryRateLimitedUntil) {
    if (isFirstPage && videoHistoryLastSuccess) {
      return videoHistoryLastSuccess.value;
    }
    const error = new Error('Too many requests, please try again later.') as Error & { status?: number; code?: string };
    error.status = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    throw error;
  }

  if (!force && videoHistoryInFlightPromise) {
    return videoHistoryInFlightPromise;
  }

  const gapRemaining = VIDEO_HISTORY_MIN_REQUEST_GAP_MS - (now - videoHistoryLastRequestedAt);
  if (!force && gapRemaining > 0) {
    if (isFirstPage && videoHistoryLastSuccess) {
      return videoHistoryLastSuccess.value;
    }
    await sleep(gapRemaining);
  }
  videoHistoryLastRequestedAt = Date.now();

  try {
    videoHistoryInFlightPromise = (async () => {
      const response: AxiosResponse<VideoHistoryResponse> = await apiClient.get(apiEndpoints.videos.history, {
        params: query,
      });
      const normalized = normalizeVideoHistory(response.data, query);
      if (isFirstPage) {
        videoHistoryLastSuccess = { value: normalized, at: Date.now() };
      }
      return normalized;
    })();

    return await videoHistoryInFlightPromise;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { status?: number; code?: string };
    if (mapped.status === 429 || (mapped.code ?? '').toUpperCase().includes('RATE_LIMIT')) {
      videoHistoryRateLimitedUntil = Date.now() + VIDEO_HISTORY_RATE_LIMIT_BACKOFF_MS;
    }
    throw mapped;
  } finally {
    videoHistoryInFlightPromise = null;
  }
}

export function invalidateVideoHistoryCache() {
  videoHistoryLastSuccess = null;
  videoHistoryRateLimitedUntil = 0;
}

export async function requestDownloadAllVideosZip() {
  try {
    const response: AxiosResponse<{ data?: { jobId?: string; pollUrl?: string } }> = await apiClient.post(
      apiEndpoints.videos.downloadZip,
      { all: true, sort: 'newest' },
    );
    const jobId = response.data?.data?.jobId;
    const pollUrl = response.data?.data?.pollUrl;
    if (!jobId && !pollUrl) {
      throw new Error('ZIP job was not accepted by the server.');
    }
    return {
      jobId: jobId ?? '',
      pollUrl: pollUrl ?? null,
    };
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteVideo(videoId: string) {
  try {
    await apiClient.delete(apiEndpoints.videos.remove(videoId));
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteVideosBulk(videoIds: string[]) {
  try {
    await apiClient.post(apiEndpoints.videos.deleteBulk, { videoIds });
  } catch (error) {
    throw mapApiError(error);
  }
}
