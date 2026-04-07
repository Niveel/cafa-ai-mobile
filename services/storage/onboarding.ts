import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'cafa_ai_onboarding_completed_v2';

export async function getOnboardingCompleted() {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted(completed: boolean) {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, completed ? '1' : '0');
  } catch {
    // Ignore storage write failures.
  }
}
