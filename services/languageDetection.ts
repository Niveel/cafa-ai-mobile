import { isAppLanguage, type AppLanguage } from '@/config';
import { apiClient, apiEndpoints } from '@/services/api';
import { shouldDetectCountryThisLaunch } from '@/services/storage/languageDetection';

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

let launchDetectionPromise: Promise<VisitorLanguageDetection | null> | null = null;

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
 * Detects the visitor's country/language on alternating fresh launches. The
 * persisted cadence produces five requests per ten launches, while the cached
 * promise ensures background/foreground transitions and React provider
 * remounts cannot advance the cadence or create duplicate requests.
 *
 * The rejected promise is intentionally retained too: transient failures must
 * wait until the next fresh launch instead of causing background retries.
 */
export function detectVisitorLanguageForLaunch(): Promise<VisitorLanguageDetection | null> {
  if (!launchDetectionPromise) {
    launchDetectionPromise = shouldDetectCountryThisLaunch().then((shouldDetect) => {
      if (!shouldDetect) {
        logLanguageDetection('skipping country check on this launch');
        return null;
      }

      return detectVisitorLanguage();
    });
  }

  return launchDetectionPromise;
}
