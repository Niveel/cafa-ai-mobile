import { AxiosResponse } from 'axios';

import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { clearGuestSessionStorage, getGuestSessionToken } from '@/services/storage';
import { AuthSession, AuthUser, LoginRequest, SignupRequest, VerifyOtpRequest } from '@/types';

export async function login(request: LoginRequest) {
  try {
    const response: AxiosResponse<{ data: AuthSession }> = await apiClient.post(apiEndpoints.auth.login, request);
    return response.data.data;
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    console.log(
      `[auth-login:error] endpoint=${API_BASE_URL}${apiEndpoints.auth.login} code=${mapped.code ?? 'unknown'} status=${mapped.status ?? 'unknown'} message="${mapped.message}"`,
    );
    throw mapped;
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

export async function resendOtp(email: string) {
  try {
    const response: AxiosResponse<{ message?: string }> = await apiClient.post(apiEndpoints.auth.resendOtp, { email });
    return response.data?.message ?? 'Verification code sent to your email';
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function forgotPassword(email: string) {
  try {
    const response: AxiosResponse<{ message?: string }> = await apiClient.post(apiEndpoints.auth.forgotPassword, { email });
    return response.data?.message ?? 'If that email is registered, a reset code has been sent';
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function claimGuestUpgradeOnLogin(accessToken: string) {
  try {
    const guestSessionToken = await getGuestSessionToken();
    if (!guestSessionToken) return;

    const endpoint = `${API_BASE_URL}/guest/upgrade/claim`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Guest-Session': guestSessionToken,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string; code?: string } | null;
      console.log(
        `[guest-claim:skip] endpoint=${endpoint} status=${response.status} code=${payload?.code ?? payload?.error ?? 'unknown'} message="${payload?.message ?? 'Claim failed'}"`,
      );
      return;
    }

    await clearGuestSessionStorage();
  } catch (error) {
    const mapped = mapApiError(error) as Error & { code?: string; status?: number };
    console.log(
      `[guest-claim:skip] code=${mapped.code ?? 'unknown'} status=${mapped.status ?? 'unknown'} message="${mapped.message}"`,
    );
  }
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  try {
    const response: AxiosResponse<{ message?: string }> = await apiClient.post(apiEndpoints.auth.resetPassword, {
      email,
      otp,
      newPassword,
    });
    return response.data?.message ?? 'Password reset successful';
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

export async function logoutAllDevices() {
  try {
    await apiClient.post(apiEndpoints.auth.logout, { allDevices: true }, { withCredentials: true });
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  try {
    await apiClient.patch(apiEndpoints.users.password, { currentPassword, newPassword });
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function updateCurrentUserProfile(payload: { name?: string; avatar?: string | null }) {
  try {
    const body: Record<string, string | null> = {};
    if (typeof payload.name === 'string') body.name = payload.name;
    if (payload.avatar !== undefined) body.avatar = payload.avatar;

    const response: AxiosResponse<{ data: Record<string, unknown> }> = await apiClient.patch(apiEndpoints.users.me, body);
    return mapAuthUser(response.data.data);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function uploadCurrentUserAvatar(file: {
  uri: string;
  name?: string;
  type?: string;
}) {
  try {
    const formData = new FormData();
    formData.append('avatar', {
      uri: file.uri,
      name: file.name ?? 'avatar.jpg',
      type: file.type ?? 'image/jpeg',
    } as unknown as Blob);

    const response: AxiosResponse<{ data?: Record<string, unknown> }> = await apiClient.post(
      apiEndpoints.users.avatar,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    const payload = response.data.data ?? {};
    const rawAvatar = payload.avatar ?? payload.avatarUrl ?? payload.url ?? payload.path ?? null;
    const normalizedAvatar = normalizeAvatarUrl(typeof rawAvatar === 'string' ? rawAvatar : null);

    return normalizedAvatar;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteCurrentUserAccount(password: string) {
  try {
    await apiClient.delete(apiEndpoints.users.me, { data: { password } });
  } catch (error) {
    throw mapApiError(error);
  }
}

function mapAuthUser(raw: Record<string, unknown>): AuthUser {
  const subscription = (raw.subscription ?? {}) as Record<string, unknown>;
  const debugRaw = raw as { avatarUrl?: unknown; profileImage?: unknown };
  const rawAvatar =
    typeof raw.avatar === 'string'
      ? raw.avatar
      : typeof debugRaw.avatarUrl === 'string'
        ? debugRaw.avatarUrl
        : typeof debugRaw.profileImage === 'string'
          ? debugRaw.profileImage
          : null;
  return {
    id: String(raw._id ?? raw.id ?? ''),
    name: String(raw.name ?? ''),
    email: String(raw.email ?? ''),
    avatar: normalizeAvatarUrl(rawAvatar),
    subscriptionTier:
      typeof subscription.tier === 'string'
        ? (subscription.tier as AuthUser['subscriptionTier'])
        : undefined,
  };
}

function normalizeAvatarUrl(input?: string | null) {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  return `${apiOrigin}${withLeadingSlash}`;
}
