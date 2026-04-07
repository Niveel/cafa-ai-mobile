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

