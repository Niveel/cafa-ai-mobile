import { AxiosResponse } from 'axios';
import { apiClient, apiEndpoints } from '@/services/api';
import { ApiResponse } from '@/types';

/**
 * Real, backend-driven starter-prompt suggestions -- ports web's
 * getSuggestedPrompts (features/chat/services/chat.ts). The backend serves
 * this from its own cached row (a plain Mongo read, no LLM call in its
 * request path either -- see prompt-suggestions.service.ts on the backend),
 * so this is real personalization, not a static local pool. Falls back to
 * the caller's own static pool on any failure -- never blocks the starter
 * prompts UI over a suggestions-fetch error.
 */
export type SuggestedPromptsData = { suggestions: string[]; personalized: boolean };

const TTL_MS = 10 * 60 * 1000;
let cache: { fetchedAt: number; data: SuggestedPromptsData } | null = null;
let inFlight: Promise<SuggestedPromptsData> | null = null;

export async function getSuggestedPrompts(): Promise<SuggestedPromptsData> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.data;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response: AxiosResponse<ApiResponse<SuggestedPromptsData>> = await apiClient.get(
      apiEndpoints.chat.suggestedPrompts,
    );
    if (!response.data?.success || !response.data.data) {
      throw new Error(response.data?.message ?? 'Could not load suggestions.');
    }
    cache = { fetchedAt: Date.now(), data: response.data.data };
    return response.data.data;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function invalidateSuggestedPromptsCache(): void {
  cache = null;
}
