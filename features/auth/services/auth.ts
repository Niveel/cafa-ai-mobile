import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { AuthSession, AuthUser, LoginRequest, SignupRequest, VerifyOtpRequest } from '@/types';

export async function login(request: LoginRequest) {
  try {
    const response: AxiosResponse<{ data: AuthSession }> = await apiClient.post(apiEndpoints.auth.login, request);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function signup(request: SignupRequest) {
  try {
    const response: AxiosResponse<{ data: AuthSession }> = await apiClient.post(apiEndpoints.auth.register, request);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function verifyOtp(request: VerifyOtpRequest) {
  try {
    const response: AxiosResponse<{ data: AuthSession }> = await apiClient.post(apiEndpoints.auth.verifyOtp, request);
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function refreshAccessToken(refreshToken?: string) {
  try {
    const response: AxiosResponse<{ data: { accessToken: string; refreshToken?: string } }> = await apiClient.post(
      apiEndpoints.auth.refreshToken,
      refreshToken ? { refreshToken } : {},
      {
        withCredentials: true,
      },
    );
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function fetchCurrentUser() {
  try {
    const response: AxiosResponse<{ data: Record<string, unknown> }> = await apiClient.get(apiEndpoints.auth.me);
    return mapAuthUser(response.data.data);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function logout(refreshToken?: string) {
  try {
    await apiClient.post(apiEndpoints.auth.logout, refreshToken ? { refreshToken } : {}, { withCredentials: true });
  } catch (error) {
    throw mapApiError(error);
  }
}

function mapAuthUser(raw: Record<string, unknown>): AuthUser {
  const subscription = (raw.subscription ?? {}) as Record<string, unknown>;

  return {
    id: String(raw._id ?? raw.id ?? ''),
    name: String(raw.name ?? ''),
    email: String(raw.email ?? ''),
    avatar: typeof raw.avatar === 'string' ? raw.avatar : null,
    subscriptionTier:
      typeof subscription.tier === 'string'
        ? (subscription.tier as AuthUser['subscriptionTier'])
        : undefined,
  };
}
