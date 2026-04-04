import { authStore } from '@/state';
import { clearAccessToken, setAccessToken } from '@/services/storage';
import { AuthUser } from '@/types';

export async function hydrateSession() {
  authStore.setState({ hydrated: true });
}

export async function saveSession(accessToken: string, user: AuthUser) {
  await setAccessToken(accessToken);
  authStore.setState({ accessToken, user, hydrated: true });
}

export async function clearSession() {
  await clearAccessToken();
  authStore.setState({ accessToken: null, user: null, hydrated: true });
}
