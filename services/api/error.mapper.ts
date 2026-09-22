import { AxiosError } from 'axios';

import { ApiErrorPayload } from '@/types';

type ApiMappedError = Error & {
  code?: string;
  status?: number;
  details?: ApiErrorPayload['errors'];
  payload?: ApiErrorPayload;
};

// Real fix (2026-09-13, error-message audit): when the backend response has
// no `message` field, this used to fall through to axios's own generic
// message (e.g. "Request failed with status code 500", "Network Error") --
// several call sites (billing, avatar) render `error.message` straight into
// the UI with no further mapping, so that raw technical text was reaching
// real users. A missing network connection has no HTTP response at all
// (still worth a specific, friendly line); anything else with no backend
// message gets one generic friendly fallback instead of axios's wording.
function friendlyFallbackMessage(error: AxiosError): string {
  if (!error.response) return 'Could not connect. Please check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export function mapApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiErrorPayload | undefined;
    const mapped = new Error(payload?.message ?? friendlyFallbackMessage(error)) as ApiMappedError;
    const fallbackCode = error.response ? undefined : (error.code ?? 'NETWORK_ERROR');
    mapped.code = payload?.code ?? payload?.error ?? fallbackCode;
    mapped.status = error.response?.status;
    mapped.details = payload?.errors;
    mapped.payload = payload;
    return mapped;
  }

  if (error instanceof Error) return error;

  return new Error('Something went wrong. Please try again.');
}
