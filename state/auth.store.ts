import { createStore } from './createStore';
import { AuthUser } from '@/types';

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
};

export const authStore = createStore<AuthState>({
  accessToken: null,
  user: null,
  hydrated: false,
});
