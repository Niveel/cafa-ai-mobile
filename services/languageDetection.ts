import { isAppLanguage, type AppLanguage } from '@/config';
import { apiClient, apiEndpoints } from '@/services/api';

function logLanguageDetection(...details: unknown[]) {
  if (__DEV__) console.log('[language-detection]', ...details);
}

export type LanguageDetectionResponse = {
  success?: boolean;
  data?: {
    detectedCountryCode?: string | null;
    detectedCountryName?: string | null;
    suggestedLanguageCode?: unknown;
    suggestedLanguageName?: string;
    suggestedLanguageNativeName?: string;
    currentDefaultLanguageCode?: string;
    shouldPrompt?: boolean;
    supportedLanguages?: unknown[];
  };
};

export type VisitorLanguageDetection = {
  language: AppLanguage;
  detectedCountryCode: string | null;
  detectedCountryName: string | null;
  raw: LanguageDetectionResponse;
};

export async function detectVisitorLanguage(): Promise<VisitorLanguageDetection> {
  logLanguageDetection('requesting', apiEndpoints.tools.checkLanguage);
  const response = await apiClient.get<LanguageDetectionResponse>(apiEndpoints.tools.checkLanguage);
  logLanguageDetection('backend response', JSON.stringify(response.data, null, 2));

  const language = response.data.data?.suggestedLanguageCode;
  const normalizedLanguage = isAppLanguage(language) ? language : 'en';
  const result = {
    language: normalizedLanguage,
    detectedCountryCode: response.data.data?.detectedCountryCode ?? null,
    detectedCountryName: response.data.data?.detectedCountryName ?? null,
    raw: response.data,
  };

  logLanguageDetection('normalized result', JSON.stringify({
    detectedCountryCode: result.detectedCountryCode,
    detectedCountryName: result.detectedCountryName,
    backendLanguage: language ?? null,
    appliedLanguage: result.language,
    backendLanguageSupported: isAppLanguage(language),
  }));

  return result;
}
