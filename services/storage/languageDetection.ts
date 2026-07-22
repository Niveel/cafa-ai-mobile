import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAppLanguage, type AppLanguage } from '@/config';

const PENDING_DETECTED_LANGUAGE_SYNC_KEY = 'cafa_ai_pending_detected_language_sync_v1';

export async function saveDetectedLanguageForAccountSync(language: AppLanguage) {
  await AsyncStorage.setItem(PENDING_DETECTED_LANGUAGE_SYNC_KEY, language);
}

export async function getPendingDetectedLanguageSync(): Promise<AppLanguage | null> {
  try {
    const language = await AsyncStorage.getItem(PENDING_DETECTED_LANGUAGE_SYNC_KEY);
    return isAppLanguage(language) ? language : null;
  } catch {
    return null;
  }
}

export async function clearPendingDetectedLanguageSync() {
  await AsyncStorage.removeItem(PENDING_DETECTED_LANGUAGE_SYNC_KEY);
}
