import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ArtifactItem, ArtifactListPage, ArtifactQuery } from '@/types';

type ArtifactListResponse = {
  data?: ArtifactItem[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
};

export async function getArtifactsPage(query: ArtifactQuery = {}): Promise<ArtifactListPage> {
  try {
    const response: AxiosResponse<ArtifactListResponse> = await apiClient.get(apiEndpoints.artifacts.list, {
      params: query,
    });
    const artifacts = response.data?.data ?? [];
    const page = response.data?.pagination?.page ?? query.page ?? 1;
    const limit = response.data?.pagination?.limit ?? query.limit ?? (artifacts.length || 20);
    const total = response.data?.pagination?.total ?? artifacts.length;
    const pages = response.data?.pagination?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
    return {
      artifacts,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    };
  } catch (error) {
    throw mapApiError(error);
  }
}
