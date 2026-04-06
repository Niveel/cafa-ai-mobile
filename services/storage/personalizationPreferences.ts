import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_VOICE_STORAGE_KEY = 'cafa-default-voice-id';

export async function getDefaultVoicePreference() {
  return AsyncStorage.getItem(DEFAULT_VOICE_STORAGE_KEY);
}

export async function setDefaultVoicePreference(voiceId: string) {
  await AsyncStorage.setItem(DEFAULT_VOICE_STORAGE_KEY, voiceId);
}

