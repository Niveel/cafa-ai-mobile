import { AxiosResponse } from 'axios';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ApiResponse, EditImageRequest, EditImageResult, GenerateImageRequest, ImageHistoryItem, ImageHistoryPage, ImageHistoryQuery } from '@/types';

const MEDIA_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MEDIA_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type ApiMappedError = Error & {
  code?: string;
  status?: number;
};

function createMediaImageError(message: string, code: string, status?: number): ApiMappedError {
  const error = new Error(message) as ApiMappedError;
  error.code = code;
  error.status = status;
  return error;
}

function inferImageMimeType(fileName?: string, providedMimeType?: string) {
  const normalizedProvided = (providedMimeType ?? '').trim().toLowerCase();
  if (normalizedProvided) return normalizedProvided;
  const normalizedName = (fileName ?? '').toLowerCase();
  if (normalizedName.endsWith('.png')) return 'image/png';
  if (normalizedName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function validateEditableImageUpload(image: EditImageRequest['image']) {
  if (!image.uri?.trim()) {
    throw createMediaImageError('Please upload an image to continue.', 'MISSING_IMAGE', 400);
  }

  const mimeType = inferImageMimeType(image.fileName, image.mimeType);
  if (!MEDIA_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw createMediaImageError('Only JPEG, PNG, and WebP images are supported.', 'INVALID_FILE_TYPE', 400);
  }

  if (image.uri.startsWith('file://')) {
    const info = await LegacyFileSystem.getInfoAsync(image.uri);
    if (!info.exists) {
      throw createMediaImageError('The uploaded image appears to be empty or corrupted.', 'INVALID_IMAGE', 400);
    }
    if (typeof info.size === 'number' && info.size > MEDIA_MAX_IMAGE_SIZE_BYTES) {
      throw createMediaImageError('Image must be 10MB or smaller.', 'INVALID_IMAGE', 400);
    }
  }

  return mimeType;
}

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

export async function editImage(request: EditImageRequest) {
  captureEvent(AnalyticsEvents.imageGenerationStarted, {
    hasPrompt: Boolean(request.prompt?.trim()),
    mode: 'edit-image',
  });

  const normalizedPrompt = request.prompt.trim();
  if (!normalizedPrompt) {
    throw createMediaImageError('Please provide a prompt describing what you want.', 'MISSING_PROMPT', 400);
  }

  const normalizedMimeType = await validateEditableImageUpload(request.image);
  const formData = new FormData();
  formData.append('prompt', normalizedPrompt);
  const imageFile = {
    uri: request.image.uri,
    name: request.image.fileName ?? `image-${Date.now()}.${normalizedMimeType === 'image/png' ? 'png' : normalizedMimeType === 'image/webp' ? 'webp' : 'jpg'}`,
    type: normalizedMimeType,
  } as unknown as { uri: string; name: string; type: string };
  formData.append('image', imageFile as never);

  try {
    const response: AxiosResponse<
      | { success?: boolean; imageUrl?: string; generationTime?: number; message?: string; error?: string; code?: string }
      | { data?: { imageUrl?: string; generationTime?: number }; success?: boolean; message?: string; error?: string; code?: string }
    > = await apiClient.post(
      apiEndpoints.media.imageEdit,
      formData,
      {
        timeout: 45_000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    const payload = response.data;
    const rawResult = 'data' in payload && payload.data ? payload.data : payload;
    const result = rawResult as EditImageResult & { imageUrl?: string };

    if (payload?.success === false || !result?.imageUrl) {
      const mapped = new Error(payload?.message ?? 'Image editing failed.') as ApiMappedError;
      mapped.code = payload?.code ?? payload?.error;
      mapped.status = response.status;
      throw mapped;
    }

    captureEvent(AnalyticsEvents.imageGenerationCompleted, { mode: 'edit-image' });
    return result as EditImageResult;
  } catch (error) {
    const mapped = mapApiError(error) as ApiMappedError;
    captureEvent(AnalyticsEvents.imageGenerationFailed, { code: mapped.code ?? null, status: mapped.status ?? null, mode: 'edit-image' });
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
