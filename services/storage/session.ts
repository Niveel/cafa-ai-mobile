import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'cafa_ai_access_token';
const REFRESH_TOKEN_KEY = 'cafa_ai_refresh_token';

export async function setAccessToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function setRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearSessionTokens() {
  await Promise.all([clearAccessToken(), clearRefreshToken()]);
}
