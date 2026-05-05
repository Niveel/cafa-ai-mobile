import { AxiosError } from 'axios';

import { ApiErrorPayload } from '@/types';

type ApiMappedError = Error & {
  code?: string;
  status?: number;
};

export function mapApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiErrorPayload | undefined;
    const mapped = new Error(payload?.message ?? error.message ?? 'Request failed.') as ApiMappedError;
    const fallbackCode = error.response ? undefined : (error.code ?? 'NETWORK_ERROR');
    mapped.code = payload?.code ?? payload?.error ?? fallbackCode;
    mapped.status = error.response?.status;
    return mapped;
  }

  if (error instanceof Error) return error;

  return new Error('Unknown request error.');
}
