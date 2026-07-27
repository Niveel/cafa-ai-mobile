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

let launchDetectionPromise: Promise<VisitorLanguageDetection> | null = null;

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

/**
 * Detects the visitor's country/language at most once for the lifetime of the
 * current JavaScript runtime. Background/foreground transitions and React
 * provider remounts reuse the original result. A genuinely fresh app launch
 * creates a new runtime, allowing one new request.
 *
 * The rejected promise is intentionally retained too: transient failures must
 * wait until the next fresh launch instead of causing background retries.
 */
export function detectVisitorLanguageOncePerLaunch(): Promise<VisitorLanguageDetection> {
  if (!launchDetectionPromise) {
    launchDetectionPromise = detectVisitorLanguage();
  }

  return launchDetectionPromise;
}
