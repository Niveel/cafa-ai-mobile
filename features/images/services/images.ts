import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { GenerateImageRequest, ImageHistoryItem, ImageHistoryPage, ImageHistoryQuery } from '@/types';

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

    return {
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
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteImagesBulk(imageIds: string[]) {
  try {
    await apiClient.post(apiEndpoints.images.deleteBulk, { imageIds });
  } catch (error) {
    throw mapApiError(error);
  }
}
