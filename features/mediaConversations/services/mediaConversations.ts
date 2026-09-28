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

function mapDedicatedMediaConversation(
  dto: DedicatedMediaConversationDto,
  screen: DedicatedMediaScreen,
): DedicatedMediaConversation {
  return {
    id: dto._id,
    title: dto.title,
    // GET /chat/mode/:screen returns `mode` rather than `screen`.
    screen: dto.screen ?? (dto as { mode?: DedicatedMediaScreen }).mode ?? screen,
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
    // Web parity: the dedicated Edit Image / Image to Video conversation comes
    // from GET /chat/mode/:screen (find-or-create), and sends to it go through
    // the normal POST /chat/:id/messages stream.
    const response: AxiosResponse<DedicatedMediaConversationResponse> = await apiClient.get(
      apiEndpoints.chat.mode(screen),
      { params: query },
    );
    const conversation = mapDedicatedMediaConversation(response.data.data, screen);
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
