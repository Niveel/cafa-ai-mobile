import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { colorsByMode, ThemeColors, ThemeMode } from '@/config';

type AppContextValue = {
  isReady: boolean;
  setIsReady: (value: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  isDark: boolean;
  colors: ThemeColors;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  const systemColorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');
  const isDark = themeMode === 'dark';
  const colors = colorsByMode[themeMode];

  const value = useMemo(
    () => ({
      isReady,
      setIsReady,
      themeMode,
      setThemeMode,
      toggleThemeMode: () => setThemeMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark')),
      isDark,
      colors,
    }),
    [colors, isDark, isReady, themeMode],
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
