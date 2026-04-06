import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from './client';
import { apiEndpoints } from './endpoints';
import { ApiErrorPayload } from '@/types';
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/services/storage/session';

let authInterceptorConfigured = false;
let refreshPromise: Promise<string> | null = null;

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

function withAuthHeader(config: InternalAxiosRequestConfig, token: string) {
  const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
  return config;
}

async function requestAccessTokenRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    const response = await apiClient.post<{ data?: { accessToken?: string; refreshToken?: string } }>(
      apiEndpoints.auth.refreshToken,
      refreshToken ? { refreshToken } : {},
      {
        withCredentials: true,
        skipAuthRefresh: true,
      } as RetryableRequestConfig,
    );

    const nextAccessToken = response.data?.data?.accessToken;
    const nextRefreshToken = response.data?.data?.refreshToken;

    if (!nextAccessToken) {
      throw new Error('Refresh response did not include an access token.');
    }

    await setAccessToken(nextAccessToken);

    if (nextRefreshToken) {
      await setRefreshToken(nextRefreshToken);
    }

    return nextAccessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export function setupAuthInterceptor() {
  if (authInterceptorConfigured) return;

  apiClient.interceptors.request.use(async (config: RetryableRequestConfig) => {
    const token = await getAccessToken();
    if (!token) return config;
    return withAuthHeader(config, token);
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorPayload>) => {
      const originalConfig = error.config as RetryableRequestConfig | undefined;
      const status = error.response?.status;
      const code = error.response?.data?.code ?? error.response?.data?.error;
      const shouldTryRefresh = code === 'TOKEN_EXPIRED' || (status === 401 && !code);

      if (!originalConfig || originalConfig.skipAuthRefresh || originalConfig._retry || !shouldTryRefresh) {
        throw error;
      }

      originalConfig._retry = true;

      try {
        const nextAccessToken = await requestAccessTokenRefresh();
        return apiClient.request(withAuthHeader(originalConfig, nextAccessToken));
      } catch (refreshError) {
        await clearSessionTokens();
        throw refreshError;
      }
    },
  );

  authInterceptorConfigured = true;
}
