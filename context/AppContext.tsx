import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { colorsByMode, ThemeColors, ThemeMode } from '@/config';
import { setupAuthInterceptor } from '@/services';
import { fetchCurrentUser, logout as logoutRequest } from '@/features';
import { clearSessionTokens, getRefreshToken } from '@/services/storage/session';
import { getAccessToken } from '@/services';

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
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  const systemColorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');
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

    hydrateAuth().finally(() => {
      setIsReady(true);
    });
  }, [hydrateAuth]);

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
    }),
    [colors, isAuthenticated, isDark, isReady, signOut, themeMode],
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
