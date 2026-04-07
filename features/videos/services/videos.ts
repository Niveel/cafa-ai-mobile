import { AxiosResponse } from 'axios';

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
