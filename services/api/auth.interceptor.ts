import { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from './client';
import { getAccessToken } from '@/services/storage/session';

let authInterceptorConfigured = false;

function withAuthHeader(config: InternalAxiosRequestConfig, token: string) {
  const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
  return config;
}

export function setupAuthInterceptor() {
  if (authInterceptorConfigured) return;

  apiClient.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (!token) return config;
    return withAuthHeader(config, token);
  });

  authInterceptorConfigured = true;
}
