import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLanguage, ThemeMode } from '@/config';

export type AnimationLevel = 'full' | 'reduced' | 'off';

type AppPreferences = {
  language: AppLanguage;
  themeMode: ThemeMode;
  hapticsEnabled: boolean;
  animationLevel: AnimationLevel;
};

const APP_PREFERENCES_KEY = 'cafa_ai_app_preferences_v1';

const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'en',
  themeMode: 'dark',
  hapticsEnabled: true,
  animationLevel: 'full',
};

function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isValidLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'pt';
}

function isValidAnimationLevel(value: unknown): value is AnimationLevel {
  return value === 'full' || value === 'reduced' || value === 'off';
}

export async function getAppPreferences() {
  try {
    const raw = await AsyncStorage.getItem(APP_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      language: isValidLanguage(parsed.language) ? parsed.language : DEFAULT_PREFERENCES.language,
      themeMode: isValidThemeMode(parsed.themeMode) ? parsed.themeMode : DEFAULT_PREFERENCES.themeMode,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === 'boolean'
          ? parsed.hapticsEnabled
          : DEFAULT_PREFERENCES.hapticsEnabled,
      animationLevel: isValidAnimationLevel(parsed.animationLevel)
        ? parsed.animationLevel
        : DEFAULT_PREFERENCES.animationLevel,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function setAppPreferences(next: AppPreferences) {
  await AsyncStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(next));
}

export { DEFAULT_PREFERENCES };
