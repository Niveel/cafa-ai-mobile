import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from './client';
import { apiEndpoints } from './endpoints';
import { ApiErrorPayload } from '@/types';
import {
  clearRefreshToken,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/services/storage/session';

let authInterceptorConfigured = false;
let refreshPromise: Promise<string> | null = null;

export type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _retried429?: boolean;
  skipAuthRefresh?: boolean;
};

// Web parity: a 429 on a read is retried once after Retry-After (seconds or an
// HTTP date; default 0.9 s, capped at 5 s). Plan and credit limits are never
// retried -- waiting doesn't fix them.
const MAX_READ_RETRY_AFTER_MS = 5_000;

function getRetryAfterMs(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 900;
  const seconds = Number(raw);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : new Date(raw).getTime() - Date.now();
  return Math.max(0, Math.min(MAX_READ_RETRY_AFTER_MS, Number.isFinite(ms) ? ms : 900));
}

function isRetryableReadRateLimit(error: AxiosError<ApiErrorPayload>, config?: RetryableRequestConfig) {
  if (!config || config._retried429 || error.response?.status !== 429) return false;
  if ((config.method ?? 'get').toLowerCase() !== 'get') return false;
  const payload = error.response?.data as { code?: string; error?: string } | undefined;
  const code = (payload?.code ?? payload?.error ?? '').toUpperCase();
  return code !== 'RATE_LIMIT_EXCEEDED' && code !== 'CREDIT_LIMIT_EXCEEDED';
}

function withAuthHeader(config: InternalAxiosRequestConfig, token: string) {
  const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
  return config;
}

// Only a 401 from the refresh endpoint ends the session (MISSING_TOKEN /
// INVALID_TOKEN). A 429, 5xx or network failure is "try again later".
function isTerminalRefreshFailure(error: unknown) {
  if (!(error instanceof AxiosError)) return false;
  return error.response?.status === 401;
}

/**
 * The backend never puts the refresh token in a JSON body: it arrives only as
 * `Set-Cookie: refreshToken=<value>; Path=/api; HttpOnly; ...` on login,
 * verify-otp and every refresh, and it is single-use (each refresh rotates
 * it). Returns null when the header is missing, unreadable, or a clear.
 */
export function extractRefreshTokenFromHeaders(headers: unknown): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const record = headers as Record<string, unknown> & { get?: (name: string) => unknown };
  const raw = typeof record.get === 'function'
    ? record.get('set-cookie')
    : record['set-cookie'] ?? record['Set-Cookie'];
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  for (const value of values) {
    const match = /(?:^|[\s,;])refreshToken=([^;,\s]+)/.exec(String(value));
    if (match?.[1]) return match[1];
  }
  return null;
}

// After a failed refresh, don't try again for 5 s (same as web): a burst of
// parallel 401s would otherwise each fire their own refresh.
const REFRESH_FAILURE_COOLDOWN_MS = 5_000;
let lastRefreshFailureAt = 0;

export async function requestAccessTokenRefresh() {
  if (refreshPromise) return refreshPromise;
  if (Date.now() - lastRefreshFailureAt < REFRESH_FAILURE_COOLDOWN_MS) {
    throw new Error('Token refresh recently failed; try again shortly.');
  }

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
    const nextRefreshToken =
      response.data?.data?.refreshToken ?? extractRefreshTokenFromHeaders(response.headers);

    if (!nextAccessToken) {
      throw new Error('Refresh response did not include an access token.');
    }

    await setAccessToken(nextAccessToken);
    if (__DEV__) {
      console.log('[auth] refresh ok; sent stored token:', refreshToken ? 'yes' : 'no', '| rotated token:', nextRefreshToken ? 'captured' : 'missing');
    }

    // The token just sent is now invalid (single-use rotation). Store the new
    // one; if it couldn't be read, drop the stale copy so the next refresh
    // falls back to the native cookie store instead of replaying a dead token.
    if (nextRefreshToken) {
      await setRefreshToken(nextRefreshToken);
    } else if (refreshToken) {
      await clearRefreshToken();
    }

    return nextAccessToken;
  })()
    .catch(async (error) => {
      lastRefreshFailureAt = Date.now();
      if (isTerminalRefreshFailure(error)) {
        await clearSessionTokens();
      }
      throw error;
    })
    .finally(() => {
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

      if (originalConfig && isRetryableReadRateLimit(error, originalConfig)) {
        originalConfig._retried429 = true;
        const waitMs = getRetryAfterMs(error.response?.headers?.['retry-after']);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return apiClient.request(originalConfig);
      }
      // Backends do not always distinguish expired tokens from other unauthorized
      // access-token failures. Any authenticated 401 should get one silent refresh.
      const shouldTryRefresh = status === 401;

      if (!originalConfig || originalConfig.skipAuthRefresh || originalConfig._retry || !shouldTryRefresh) {
        throw error;
      }

      originalConfig._retry = true;

      try {
        const nextAccessToken = await requestAccessTokenRefresh();
        return apiClient.request(withAuthHeader(originalConfig, nextAccessToken));
      } catch (refreshError) {
        throw refreshError;
      }
    },
  );

  authInterceptorConfigured = true;
}
