import { AxiosError } from 'axios';

import { ApiErrorPayload } from '@/types';

export function mapApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiErrorPayload | undefined;
    return new Error(payload?.message ?? error.message ?? 'Request failed.');
  }

  if (error instanceof Error) return error;

  return new Error('Unknown request error.');
}
