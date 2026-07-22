import { isAppLanguage, type AppLanguage } from '@/config';
import { apiClient, apiEndpoints } from '@/services/api';

type LanguageDetectionResponse = {
  success?: boolean;
  data?: {
    suggestedLanguageCode?: unknown;
  };
};

export async function detectVisitorLanguage(): Promise<AppLanguage> {
  const response = await apiClient.get<LanguageDetectionResponse>(apiEndpoints.tools.checkLanguage);
  const language = response.data.data?.suggestedLanguageCode;
  return isAppLanguage(language) ? language : 'en';
}
