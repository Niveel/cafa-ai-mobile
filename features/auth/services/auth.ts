import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { AuthSession, LoginRequest, SignupRequest, VerifyOtpRequest } from '@/types';

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
