import * as SecureStore from 'expo-secure-store';

const GUEST_SESSION_TOKEN_KEY = 'cafa_ai_guest_session_token';
const GUEST_SESSION_EXPIRES_AT_KEY = 'cafa_ai_guest_session_expires_at';

export async function setGuestSessionToken(token: string) {
  await SecureStore.setItemAsync(GUEST_SESSION_TOKEN_KEY, token);
}

export async function getGuestSessionToken() {
  return SecureStore.getItemAsync(GUEST_SESSION_TOKEN_KEY);
}

export async function clearGuestSessionToken() {
  await SecureStore.deleteItemAsync(GUEST_SESSION_TOKEN_KEY);
}

export async function setGuestSessionExpiresAt(expiresAt: string) {
  await SecureStore.setItemAsync(GUEST_SESSION_EXPIRES_AT_KEY, expiresAt);
}

export async function getGuestSessionExpiresAt() {
  return SecureStore.getItemAsync(GUEST_SESSION_EXPIRES_AT_KEY);
}

export async function clearGuestSessionExpiresAt() {
  await SecureStore.deleteItemAsync(GUEST_SESSION_EXPIRES_AT_KEY);
}

export async function clearGuestSessionStorage() {
  await Promise.all([clearGuestSessionToken(), clearGuestSessionExpiresAt()]);
}
