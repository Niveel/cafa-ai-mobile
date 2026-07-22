import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAppLanguage, type AppLanguage } from '@/config';

const LANGUAGE_DETECTION_COMPLETED_KEY = 'cafa_ai_language_detection_completed_v1';
const PENDING_DETECTED_LANGUAGE_SYNC_KEY = 'cafa_ai_pending_detected_language_sync_v1';

export async function getLanguageDetectionCompleted() {
  try {
    return (await AsyncStorage.getItem(LANGUAGE_DETECTION_COMPLETED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function completeLanguageDetection(language: AppLanguage) {
  await AsyncStorage.multiSet([
    [LANGUAGE_DETECTION_COMPLETED_KEY, '1'],
    [PENDING_DETECTED_LANGUAGE_SYNC_KEY, language],
  ]);
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
