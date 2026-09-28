import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import type { ApiResponse } from '@/types';

type ContactSupportRequest = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type ContactSupportResponse = {
  ticketId?: string;
};

export async function submitSupportContact(request: ContactSupportRequest) {
  try {
    const response: AxiosResponse<ApiResponse<ContactSupportResponse>> = await apiClient.post(
      apiEndpoints.support.contact,
      request,
    );
    return {
      message: response.data.message ?? 'Support request received. We will reply by email.',
      data: response.data.data,
    };
  } catch (error) {
    throw mapApiError(error);
  }
}

export type QuickHelpMessage = { role: 'user' | 'assistant'; content: string };

const QUICK_HELP_MAX_HISTORY_TURNS = 6;

/**
 * Real, public quick-help chatbot -- ports web's QuickHelpWidget.tsx. No
 * auth required (the backend route is public); works the same for a
 * signed-out visitor as web's does. Only the last few turns are sent as
 * history, matching web's own trim.
 */
export async function sendQuickHelpMessage(message: string, history: QuickHelpMessage[]) {
  try {
    const trimmedHistory = history.slice(-QUICK_HELP_MAX_HISTORY_TURNS * 2);
    const response: AxiosResponse<ApiResponse<{ reply: string }>> = await apiClient.post(
      apiEndpoints.support.quickHelp,
      { message, history: trimmedHistory },
    );
    if (!response.data?.success || !response.data.data?.reply) {
      throw new Error(response.data?.message ?? 'Could not get an answer right now. Please try again.');
    }
    return response.data.data.reply;
  } catch (error) {
    throw mapApiError(error);
  }
}

