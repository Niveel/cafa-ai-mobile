import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppLanguage, colorsByMode, ThemeColors, ThemeMode, translate } from '@/config';
import { setupAuthInterceptor } from '@/services';
import { fetchCurrentUser, logout as logoutRequest } from '@/features';
import { clearSessionTokens, getRefreshToken } from '@/services/storage/session';
import { getAccessToken, getAppPreferences, setAppPreferences, type AnimationLevel } from '@/services';
import { setAnimationLevel as applyAnimationLevel, setHapticsEnabled as applyHapticsEnabled } from '@/utils';

type AppContextValue = {
  isReady: boolean;
  setIsReady: (value: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  isDark: boolean;
  colors: ThemeColors;
  isAuthenticated: boolean;
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
  const systemColorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const initialThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [animationLevel, setAnimationLevel] = useState<AnimationLevel>('full');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const isDark = themeMode === 'dark';
  const colors = colorsByMode[themeMode];

  const hydrateAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();

      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      await fetchCurrentUser();
      setIsAuthenticated(true);
    } catch {
      await clearSessionTokens();
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    setupAuthInterceptor();

    const hydrateApp = async () => {
      try {
        const prefs = await getAppPreferences();
        setThemeMode(prefs.themeMode);
        setLanguage(prefs.language);
        setHapticsEnabled(prefs.hapticsEnabled);
        setAnimationLevel(prefs.animationLevel);
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

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();

    try {
      await logoutRequest(refreshToken ?? undefined);
    } catch {
      // Intentionally ignore logout transport failures and always clear local session.
    } finally {
      await clearSessionTokens();
      setIsAuthenticated(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      setIsReady,
      themeMode,
      setThemeMode,
      toggleThemeMode: () => setThemeMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark')),
      isDark,
      colors,
      isAuthenticated,
      login: () => setIsAuthenticated(true),
      signup: () => setIsAuthenticated(true),
      signOut,
      language,
      setLanguage,
      hapticsEnabled,
      setHapticsEnabled,
      animationLevel,
      setAnimationLevel,
      t: (key: string, params?: Record<string, string>) => translate(language, key, params),
    }),
    [animationLevel, colors, hapticsEnabled, isAuthenticated, isDark, isReady, language, signOut, themeMode],
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
