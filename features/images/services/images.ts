import { AxiosResponse } from 'axios';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ApiResponse, GenerateImageRequest, ImageHistoryItem, ImageHistoryPage, ImageHistoryQuery } from '@/types';

export async function generateImage(request: GenerateImageRequest) {
  captureEvent(AnalyticsEvents.imageGenerationStarted, {
    hasPrompt: Boolean((request as { prompt?: string }).prompt?.trim()),
  });
  try {
    const response: AxiosResponse<ApiResponse<ImageHistoryItem> & { error?: string; code?: string }> =
      await apiClient.post(apiEndpoints.images.generate, request);
    const payload = response.data;
    const generated = payload?.data;

    if (payload?.success === false || !generated) {
      const mapped = new Error(payload?.message ?? 'Image generation failed.') as Error & { code?: string; status?: number };
      mapped.code = payload?.code ?? payload?.error;
      mapped.status = response.status;
      throw mapped;
    }

    if (!generated.imageUrl) {
      const mapped = new Error(payload?.message ?? 'Could not generate image right now.') as Error & { code?: string; status?: number };
      mapped.code = payload?.code ?? payload?.error;
      mapped.status = response.status;
      throw mapped;
    }

    captureEvent(AnalyticsEvents.imageGenerationCompleted, { imageId: (generated as { id?: string })?.id ?? null });
    return generated;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    captureEvent(AnalyticsEvents.imageGenerationFailed, { code: mapped.code ?? null, status: mapped.status ?? null });
    throw mapped;
  }
}

export async function getImageHistory() {
  try {
    const response: AxiosResponse<{ data: ImageHistoryItem[] }> = await apiClient.get(apiEndpoints.images.history);
    captureEvent(AnalyticsEvents.imageHistoryLoaded, { count: response.data.data?.length ?? 0, paged: false });
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

type ImageHistoryResponse =
  | { data: ImageHistoryItem[] }
  | {
      data: {
        images?: ImageHistoryItem[];
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

export async function getImageHistoryPage(query: ImageHistoryQuery = {}): Promise<ImageHistoryPage> {
  try {
    const response: AxiosResponse<ImageHistoryResponse> = await apiClient.get(apiEndpoints.images.history, {
      params: query,
    });
    const payload = response.data.data;

    if (Array.isArray(payload)) {
      const page = query.page ?? 1;
      const limit = query.limit ?? (payload.length || 20);
      return {
        images: payload,
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

    const images = payload.images ?? [];
    const pagination = payload.pagination;
    const page = pagination?.page ?? query.page ?? 1;
    const limit = pagination?.limit ?? query.limit ?? (images.length || 20);
    const total = pagination?.total ?? images.length;
    const pages = pagination?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
    const hasNextPage = pagination?.hasNextPage ?? page < pages;

    const result = {
      images,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNextPage,
        nextCursor: pagination?.nextCursor ?? null,
      },
    };
    captureEvent(AnalyticsEvents.imageHistoryLoaded, {
      count: result.images.length,
      page: result.pagination.page,
      hasNextPage: result.pagination.hasNextPage,
      paged: true,
    });
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function requestDownloadAllImagesZip() {
  try {
    const response: AxiosResponse<{ data?: { jobId?: string; pollUrl?: string } }> = await apiClient.post(
      apiEndpoints.images.downloadZip,
      { all: true },
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

export async function deleteImage(imageId: string) {
  try {
    await apiClient.delete(apiEndpoints.images.remove(imageId));
    captureEvent(AnalyticsEvents.imageDeleted, { imageId, bulk: false });
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteImagesBulk(imageIds: string[]) {
  try {
    await apiClient.post(apiEndpoints.images.deleteBulk, { imageIds });
    captureEvent(AnalyticsEvents.imageDeleted, { bulk: true, count: imageIds.length });
  } catch (error) {
    throw mapApiError(error);
  }
}
