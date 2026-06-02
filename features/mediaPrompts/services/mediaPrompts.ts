import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ApiResponse, MediaPromptRewriteRequest, MediaPromptRewriteResult } from '@/types';

type MediaPromptRewriteResponse =
  | ApiResponse<MediaPromptRewriteResult>
  | {
      success?: boolean;
      data?: MediaPromptRewriteResult;
      message?: string;
      error?: string;
      code?: string;
    };

export async function rewriteMediaPrompt(request: MediaPromptRewriteRequest) {
  try {
    const response: AxiosResponse<MediaPromptRewriteResponse> = await apiClient.post(
      apiEndpoints.media.promptRewrite,
      request,
      {
        timeout: 20_000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    const payload = response.data;
    const data = payload?.data;
    if (payload?.success === false || !data?.intent || typeof data.rewrittenPrompt !== 'string') {
      const fallbackPayload = payload as {
        code?: string;
        error?: string;
        message?: string;
      };
      const mapped = new Error(payload?.message ?? 'Prompt rewrite failed.') as Error & {
        code?: string;
        status?: number;
      };
      mapped.code = fallbackPayload.code ?? fallbackPayload.error;
      mapped.status = response.status;
      throw mapped;
    }

    return data;
  } catch (error) {
    throw mapApiError(error);
  }
}
