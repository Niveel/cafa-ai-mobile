import { AxiosResponse } from 'axios';

import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { UpdatePersonalizationRequest, UserPersonalization } from '@/types';

type PersonalizationApiResponse = {
  success?: boolean;
  data?: {
    personalization?: UserPersonalization;
  };
  message?: string;
  code?: string;
  error?: string;
};

const DEFAULT_PERSONALIZATION: UserPersonalization = {
  language: 'en',
  tone: 'balanced',
  responseLength: 'medium',
  creativity: 0.7,
  voiceEnabled: false,
  memoryEnabled: true,
  aboutYou: {
    nickname: '',
    occupation: '',
    about: '',
  },
};

function normalizePersonalization(raw?: UserPersonalization): UserPersonalization {
  if (!raw) return DEFAULT_PERSONALIZATION;
  return {
    language: raw.language ?? DEFAULT_PERSONALIZATION.language,
    tone: raw.tone ?? DEFAULT_PERSONALIZATION.tone,
    responseLength: raw.responseLength ?? DEFAULT_PERSONALIZATION.responseLength,
    creativity:
      typeof raw.creativity === 'number' && Number.isFinite(raw.creativity)
        ? Math.max(0, Math.min(1, raw.creativity))
        : DEFAULT_PERSONALIZATION.creativity,
    voiceEnabled: Boolean(raw.voiceEnabled),
    memoryEnabled: typeof raw.memoryEnabled === 'boolean' ? raw.memoryEnabled : DEFAULT_PERSONALIZATION.memoryEnabled,
    aboutYou: {
      nickname: raw.aboutYou?.nickname ?? '',
      occupation: raw.aboutYou?.occupation ?? '',
      about: raw.aboutYou?.about ?? '',
    },
  };
}

export async function getUserPersonalization() {
  try {
    const response: AxiosResponse<PersonalizationApiResponse> = await apiClient.get(
      apiEndpoints.users.personalization,
    );
    return normalizePersonalization(response.data.data?.personalization);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function updateUserPersonalization(payload: UpdatePersonalizationRequest) {
  try {
    const response: AxiosResponse<PersonalizationApiResponse> = await apiClient.patch(
      apiEndpoints.users.personalization,
      payload,
    );
    return normalizePersonalization(response.data.data?.personalization);
  } catch (error) {
    throw mapApiError(error);
  }
}
