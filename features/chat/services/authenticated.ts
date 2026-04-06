import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import { ApiResponse } from '@/types';

type AuthConversationSummaryDto = {
  _id: string;
  title: string;
  aiModel?: string;
  lastMessagePreview?: string;
  totalTokens?: number;
  createdAt: string;
  updatedAt: string;
};

type AuthConversationDetailDto = {
  _id: string;
  title: string;
  aiModel?: string;
  totalTokens?: number;
  lastMessagePreview?: string;
  messages?: Array<{
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    reactions?: { liked?: boolean; disliked?: boolean };
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AuthConversationSummary = {
  id: string;
  title: string;
  model: string;
  preview: string;
  updatedAt: string;
};

export type AuthConversationDetail = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    reactions?: { liked: boolean; disliked: boolean };
  }>;
};

export type AuthChatStreamEvent =
  | { type: 'meta'; model?: string; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'delta'; content: string; requestId?: string; timestamp?: string }
  | { type: 'done'; tokens?: number; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'error'; code?: string; message: string; requestId?: string; timestamp?: string };

function mapSummary(dto: AuthConversationSummaryDto): AuthConversationSummary {
  return {
    id: dto._id,
    title: dto.title,
    model: dto.aiModel ?? 'gpt-4o-mini',
    preview: dto.lastMessagePreview ?? '',
    updatedAt: dto.updatedAt,
  };
}

function mapDetail(dto: AuthConversationDetailDto): AuthConversationDetail {
  return {
    id: dto._id,
    title: dto.title,
    model: dto.aiModel ?? 'gpt-4o-mini',
    updatedAt: dto.updatedAt,
    messages: (dto.messages ?? []).map((message) => ({
      id: message._id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      tokens: message.tokens,
      reactions: {
        liked: Boolean(message.reactions?.liked),
        disliked: Boolean(message.reactions?.disliked),
      },
    })),
  };
}

async function parseHttpError(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | { code?: string; error?: string; message?: string }
    | null;

  const error = new Error(payload?.message ?? fallbackMessage) as Error & { code?: string; status?: number };
  error.code = payload?.code ?? payload?.error;
  error.status = response.status;
  return error;
}

export async function listAuthenticatedConversations() {
  try {
    const response = await apiClient.get<ApiResponse<AuthConversationSummaryDto[]>>(apiEndpoints.chat.list);
    return (response.data.data ?? []).map(mapSummary);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function searchAuthenticatedConversations(query: string) {
  try {
    const response = await apiClient.get<ApiResponse<AuthConversationSummaryDto[]>>(apiEndpoints.chat.search, {
      params: { q: query, page: 1, limit: 50 },
    });
    return (response.data.data ?? []).map(mapSummary);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getAuthenticatedConversation(conversationId: string) {
  try {
    const response = await apiClient.get<ApiResponse<AuthConversationDetailDto>>(
      apiEndpoints.chat.detail(conversationId),
    );
    return mapDetail(response.data.data);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function createAuthenticatedConversation(title?: string) {
  try {
    const response = await apiClient.post<ApiResponse<{ conversationId: string; title: string }>>(
      apiEndpoints.chat.list,
      title ? { title } : {},
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function toggleAuthenticatedMessageReaction(
  conversationId: string,
  messageId: string,
  action: 'like' | 'dislike',
) {
  try {
    const endpoint = `${apiEndpoints.chat.detail(conversationId)}/messages/${messageId}/react`;
    const response = await apiClient.patch<ApiResponse<{ reactions: { liked: boolean; disliked: boolean } }>>(
      endpoint,
      { action },
    );
    return response.data.data.reactions;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function archiveAuthenticatedConversation(conversationId: string, isArchived = true) {
  try {
    await apiClient.patch(apiEndpoints.chat.archive(conversationId), { isArchived });
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteAuthenticatedConversation(conversationId: string) {
  try {
    await apiClient.delete(apiEndpoints.chat.detail(conversationId));
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function sendAuthenticatedMessageStream(
  conversationId: string,
  message: string,
  onEvent: (event: AuthChatStreamEvent) => void,
) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Missing access token for authenticated chat.');
  }

  const formData = new FormData();
  formData.append('message', message);
  formData.append('content', message);

  const response = await fetch(`${API_BASE_URL}${apiEndpoints.chat.messages(conversationId)}`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw await parseHttpError(response, 'Could not send your message right now.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error('Missing response stream from authenticated chat.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response stream was returned by the server.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data:'));
      if (!dataLine) continue;

      const raw = dataLine.replace(/^data:\s*/, '');
      const event = JSON.parse(raw) as AuthChatStreamEvent;
      onEvent(event);

      if (event.type === 'error') {
        throw new Error(event.message || 'Authenticated stream failed.');
      }
    }
  }
}
