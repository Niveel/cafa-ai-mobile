import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { usePostHog } from 'posthog-react-native';

import { AppLanguage, colorsByMode, ThemeColors, ThemeMode, translate } from '@/config';
import { setupAuthInterceptor } from '@/services';
import {
  fetchCurrentUser,
  invalidateAuthenticatedChatCache,
  invalidateGuestChatCache,
  logout as logoutRequest,
} from '@/features';
import { clearSessionTokens, getRefreshToken } from '@/services/storage/session';
import {
  getAccessToken,
  getAppPreferences,
  setAppPreferences,
  getOnboardingCompleted,
  setOnboardingCompleted,
  type AnimationLevel,
} from '@/services';
import { AuthUser } from '@/types';
import { setAnimationLevel as applyAnimationLevel, setHapticsEnabled as applyHapticsEnabled } from '@/utils';

type AppContextValue = {
  isReady: boolean;
  setIsReady: (value: boolean) => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  isDark: boolean;
  colors: ThemeColors;
  isAuthenticated: boolean;
  authUser: AuthUser | null;
  refreshAuthUser: () => Promise<void>;
  setAuthSubscriptionTier: (tier: AuthUser['subscriptionTier']) => void;
  login: () => void;
  signup: () => void;
  signOut: () => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  animationLevel: AnimationLevel;
  setAnimationLevel: (level: AnimationLevel) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  const posthog = usePostHog();
  const systemColorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const initialThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [animationLevel, setAnimationLevel] = useState<AnimationLevel>('full');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const hasTrackedAppOpenRef = useRef(false);
  const appDebug = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!__DEV__) return;
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.log(`[app-debug] ${event}${suffix}`);
  }, []);
  const isDark = themeMode === 'dark';
  const colors = colorsByMode[themeMode];

  const hydrateAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();

      if (!token) {
        invalidateAuthenticatedChatCache();
        invalidateGuestChatCache();
        setIsAuthenticated(false);
        setAuthUser(null);
        return;
      }

      const me = await fetchCurrentUser();
      appDebug('auth:hydrate:success', {
        userId: me?.id ?? null,
        subscriptionTier: me?.subscriptionTier ?? 'free',
      });
      setIsAuthenticated(true);
      setAuthUser(me);
    } catch {
      appDebug('auth:hydrate:error');
      invalidateAuthenticatedChatCache();
      invalidateGuestChatCache();
      await clearSessionTokens();
      setIsAuthenticated(false);
      setAuthUser(null);
    }
  }, [appDebug]);

  useEffect(() => {
    setupAuthInterceptor();

    const hydrateApp = async () => {
      try {
        const [prefs, onboardingDone] = await Promise.all([
          getAppPreferences(),
          getOnboardingCompleted(),
        ]);
        setThemeMode(prefs.themeMode);
        setLanguage(prefs.language);
        setHapticsEnabled(prefs.hapticsEnabled);
        setAnimationLevel(prefs.animationLevel);
        setHasCompletedOnboarding(onboardingDone);
      } catch {
        // Safe fallback defaults are already set.
      }

      await hydrateAuth();
      setIsReady(true);
    };

    void hydrateApp();
  }, [hydrateAuth]);

  useEffect(() => {
    applyHapticsEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  useEffect(() => {
    applyAnimationLevel(animationLevel);
  }, [animationLevel]);

  useEffect(() => {
    if (!isReady) return;
    void setAppPreferences({
      language,
      themeMode,
      hapticsEnabled,
      animationLevel,
    });
  }, [animationLevel, hapticsEnabled, isReady, language, themeMode]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !authUser?.id) return;

    posthog.identify(authUser.id, {
      email: authUser.email,
      name: authUser.name,
      subscriptionTier: authUser.subscriptionTier ?? 'free',
    });
  }, [authUser?.email, authUser?.id, authUser?.name, authUser?.subscriptionTier, isAuthenticated, isReady, posthog]);

  useEffect(() => {
    if (!isReady || hasTrackedAppOpenRef.current) return;
    hasTrackedAppOpenRef.current = true;
    posthog.capture('app_opened', {
      isAuthenticated,
      hasCompletedOnboarding,
      themeMode,
      language,
    });
    (posthog as { flush?: () => void }).flush?.();
  }, [hasCompletedOnboarding, isAuthenticated, isReady, language, posthog, themeMode]);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();

    try {
      await logoutRequest(refreshToken ?? undefined);
    } catch {
      // Intentionally ignore logout transport failures and always clear local session.
    } finally {
      posthog.reset();
      invalidateAuthenticatedChatCache();
      invalidateGuestChatCache();
      await clearSessionTokens();
      setIsAuthenticated(false);
      setAuthUser(null);
    }
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    void hydrateAuth();
  }, [hydrateAuth]);

  const signup = useCallback(() => {
    setIsAuthenticated(true);
    void hydrateAuth();
  }, [hydrateAuth]);

  const setAuthSubscriptionTier = useCallback((tier: AuthUser['subscriptionTier']) => {
    if (!tier) return;
    setAuthUser((previous) => {
      if (!previous) return previous;
      if (previous.subscriptionTier === tier) return previous;
      appDebug('auth:setSubscriptionTier', {
        userId: previous.id,
        previousTier: previous.subscriptionTier ?? 'free',
        nextTier: tier,
      });
      return {
        ...previous,
        subscriptionTier: tier,
      };
    });
  }, [appDebug]);

  useEffect(() => {
    appDebug('auth:snapshot', {
      isAuthenticated,
      userId: authUser?.id ?? null,
      subscriptionTier: authUser?.subscriptionTier ?? 'free',
    });
  }, [appDebug, authUser?.id, authUser?.subscriptionTier, isAuthenticated]);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
    void setOnboardingCompleted(true);
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      setIsReady,
      hasCompletedOnboarding,
      completeOnboarding,
      themeMode,
      setThemeMode,
      toggleThemeMode: () => setThemeMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark')),
      isDark,
      colors,
      isAuthenticated,
      authUser,
      refreshAuthUser: hydrateAuth,
      setAuthSubscriptionTier,
      login,
      signup,
      signOut,
      language,
      setLanguage,
      hapticsEnabled,
      setHapticsEnabled,
      animationLevel,
      setAnimationLevel,
      t: (key: string, params?: Record<string, string>) => translate(language, key, params),
    }),
    [
      animationLevel,
      authUser,
      colors,
      completeOnboarding,
      hasCompletedOnboarding,
      hapticsEnabled,
      hydrateAuth,
      isAuthenticated,
      isDark,
      isReady,
      language,
      login,
      signOut,
      setAuthSubscriptionTier,
      signup,
      themeMode,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }

  return context;
}
