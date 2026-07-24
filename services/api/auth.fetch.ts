import { getAccessToken } from '@/services/storage/session';

import { requestAccessTokenRefresh } from './auth.interceptor';

type AuthenticatedFetchInit = RequestInit | (() => RequestInit);

function resolveInit(init: AuthenticatedFetchInit): RequestInit {
  return typeof init === 'function' ? init() : init;
}

function withBearerToken(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}

/**
 * Authenticated fetch with the same one-refresh/one-retry behavior as apiClient.
 * Pass an init factory when the body is FormData or otherwise needs rebuilding.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: AuthenticatedFetchInit = {}) {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    accessToken = await requestAccessTokenRefresh();
  }

  let response = await fetch(input, withBearerToken(resolveInit(init), accessToken));
  if (response.status !== 401) return response;

  accessToken = await requestAccessTokenRefresh();
  response = await fetch(input, withBearerToken(resolveInit(init), accessToken));
  return response;
}
