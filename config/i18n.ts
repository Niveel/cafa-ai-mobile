import englishCatalog from './locales/en.json';

export type AppLanguage = 'en' | 'es' | 'fr' | 'pt';
export type TranslationParams = Record<string, string>;
export type CatalogValue = string | readonly string[];
export type TranslationCatalog = Record<string, CatalogValue>;

export type LanguageMetadata = {
  label: string;
  nativeLabel: string;
};

export const LANGUAGE_METADATA: Record<AppLanguage, LanguageMetadata> = {
  en: { label: 'English', nativeLabel: 'English' },
  es: { label: 'Spanish', nativeLabel: 'Espanol' },
  fr: { label: 'French', nativeLabel: 'Francais' },
  pt: { label: 'Portuguese', nativeLabel: 'Portugues' },
};

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'es', 'fr', 'pt'];

const catalogCache = new Map<AppLanguage, TranslationCatalog>([
  ['en', englishCatalog as TranslationCatalog],
]);
const catalogLoadCache = new Map<AppLanguage, Promise<TranslationCatalog>>();

const catalogLoaders: Record<AppLanguage, () => Promise<{ default: TranslationCatalog }>> = {
  en: async () => ({ default: englishCatalog as TranslationCatalog }),
  es: () => import('./locales/es.json') as Promise<{ default: TranslationCatalog }>,
  fr: () => import('./locales/fr.json') as Promise<{ default: TranslationCatalog }>,
  pt: () => import('./locales/pt.json') as Promise<{ default: TranslationCatalog }>,
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function getLanguageLabel(language: AppLanguage) {
  return LANGUAGE_METADATA[language].nativeLabel;
}

export function getLoadedCatalog(language: AppLanguage) {
  return catalogCache.get(language);
}

export function loadCatalog(language: AppLanguage): Promise<TranslationCatalog> {
  const loaded = catalogCache.get(language);
  if (loaded) return Promise.resolve(loaded);

  const pending = catalogLoadCache.get(language);
  if (pending) return pending;

  const request = catalogLoaders[language]()
    .then((module) => {
      const catalog = module.default;
      catalogCache.set(language, catalog);
      catalogLoadCache.delete(language);
      return catalog;
    })
    .catch((error) => {
      catalogLoadCache.delete(language);
      throw error;
    });

  catalogLoadCache.set(language, request);
  return request;
}

function applyParams(template: string, params?: TranslationParams) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (value, [name, replacement]) => value.replace(new RegExp(`{{${name}}}`, 'g'), replacement),
    template,
  );
}

function resolveString(language: AppLanguage, key: string) {
  const selected = catalogCache.get(language)?.[key];
  if (typeof selected === 'string') return selected;

  const fallback = catalogCache.get('en')?.[key];
  return typeof fallback === 'string' ? fallback : key;
}

export function translate(language: AppLanguage, key: string, params?: TranslationParams) {
  return applyParams(resolveString(language, key), params);
}

export function getLocalizedList(language: AppLanguage, key: string): readonly string[] {
  const selected = catalogCache.get(language)?.[key];
  if (Array.isArray(selected)) return selected;

  const fallback = catalogCache.get('en')?.[key];
  return Array.isArray(fallback) ? fallback : [];
}

export function clearLoadedCatalogsForTests() {
  for (const language of SUPPORTED_LANGUAGES) {
    if (language !== 'en') catalogCache.delete(language);
  }
  catalogLoadCache.clear();
}
