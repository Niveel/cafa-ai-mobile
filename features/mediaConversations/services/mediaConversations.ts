import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ApiResponse, DedicatedMediaConversation, DedicatedMediaConversationDto, DedicatedMediaConversationPage, DedicatedMediaConversationQuery, DedicatedMediaScreen } from '@/types';

type DedicatedMediaConversationResponse = ApiResponse<DedicatedMediaConversationDto> & {
  pagination?: {
    limit?: number;
    returned?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
    totalMessages?: number;
  };
};

function mapDedicatedMediaConversation(dto: DedicatedMediaConversationDto): DedicatedMediaConversation {
  return {
    id: dto._id,
    title: dto.title,
    screen: dto.screen,
    model: dto.aiModel ?? 'gpt-4o-mini',
    updatedAt: dto.updatedAt,
    messages: dto.messages ?? [],
  };
}

export async function getDedicatedMediaConversation(
  screen: DedicatedMediaScreen,
  query: DedicatedMediaConversationQuery = {},
): Promise<DedicatedMediaConversationPage> {
  try {
    const response: AxiosResponse<DedicatedMediaConversationResponse> = await apiClient.get(
      apiEndpoints.media.conversation(screen),
      { params: query },
    );
    const conversation = mapDedicatedMediaConversation(response.data.data);
    const pagination = response.data.pagination;
    const limit = pagination?.limit ?? query.limit ?? Math.max(conversation.messages.length, 20);
    const returned = pagination?.returned ?? conversation.messages.length;
    return {
      conversation,
      pagination: {
        limit,
        returned,
        nextCursor: pagination?.nextCursor ?? null,
        hasMore: Boolean(pagination?.hasMore),
        totalMessages: pagination?.totalMessages ?? returned,
      },
    };
  } catch (error) {
    throw mapApiError(error);
  }
}

export function isDedicatedMediaConversationUnavailable(error: unknown) {
  const typed = error as { status?: number; code?: string } | undefined;
  return typed?.status === 404 || typed?.code === 'DEDICATED_MEDIA_THREAD_LOAD_FAILED';
}
