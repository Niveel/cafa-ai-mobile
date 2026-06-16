import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { ApiResponse, PromptSuggestionContext, PromptSuggestionRequest, PromptSuggestionResult } from '@/types';

type PromptSuggestionResponse =
  | ApiResponse<PromptSuggestionResult>
  | {
      success?: boolean;
      data?: {
        suggestions?: unknown;
      };
      message?: string;
    };

function normalizePromptSuggestionContext(context?: PromptSuggestionContext): PromptSuggestionContext | undefined {
  return context;
}

export async function fetchPromptSuggestions(request: PromptSuggestionRequest) {
  const trimmed = request.partialText.trim();
  if (trimmed.length < 3) {
    return [] as string[];
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (request.authToken) {
      headers.Authorization = `Bearer ${request.authToken}`;
    }

    const response: AxiosResponse<PromptSuggestionResponse> = await apiClient.post(
      apiEndpoints.prompts.suggest,
      {
        partialText: trimmed,
        context: normalizePromptSuggestionContext(request.context),
      },
      {
        timeout: 20_000,
        signal: request.signal,
        headers,
      },
    );

    const suggestions = response.data?.data?.suggestions;
    if (!Array.isArray(suggestions)) return [];
    return suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch (error) {
    throw mapApiError(error);
  }
}
