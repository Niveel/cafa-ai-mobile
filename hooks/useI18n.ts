import { useAppContext } from '@/context';
import { getLanguageLabel, SUPPORTED_LANGUAGES, type AppLanguage } from '@/config';

export function useI18n() {
  const { language, setLanguage, t } = useAppContext();

  return {
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    getLanguageLabel: (value: AppLanguage) => getLanguageLabel(value),
  };
}
