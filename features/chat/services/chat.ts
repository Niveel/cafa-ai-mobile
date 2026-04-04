import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ChatConversation } from '@/types';

export async function listChatConversations() {
  try {
    const response: AxiosResponse<{ data: ChatConversation[] }> = await apiClient.get(apiEndpoints.chat.list);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getChatConversation(conversationId: string) {
  try {
    const response: AxiosResponse<{ data: ChatConversation }> = await apiClient.get(apiEndpoints.chat.detail(conversationId));
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
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}
