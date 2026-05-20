import { AxiosResponse } from 'axios';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ChatConversation } from '@/types';

export async function listChatConversations() {
  try {
    const response: AxiosResponse<{ data: ChatConversation[] }> = await apiClient.get(apiEndpoints.chat.list);
    captureEvent(AnalyticsEvents.chatConversationsLoaded, { count: response.data.data?.length ?? 0 });
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getChatConversation(conversationId: string) {
  try {
    const response: AxiosResponse<{ data: ChatConversation }> = await apiClient.get(apiEndpoints.chat.detail(conversationId));
    captureEvent(AnalyticsEvents.chatConversationLoaded, { conversationId });
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function createChatConversation(title?: string) {
  try {
    const response: AxiosResponse<{ data: { conversationId: string; title: string } }> = await apiClient.post(
      apiEndpoints.chat.list,
      title ? { title } : {},
    );
    captureEvent(AnalyticsEvents.chatConversationCreated, {
      conversationId: response.data.data?.conversationId ?? null,
      hasTitle: Boolean(title?.trim()),
    });
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
