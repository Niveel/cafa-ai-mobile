import { useAppContext } from '@/context';

export function useAppTheme() {
  const { themeMode, isDark, colors, toggleThemeMode, setThemeMode } = useAppContext();

  return {
    colorScheme: themeMode,
    themeMode,
    isDark,
    colors,
    toggleThemeMode,
    setThemeMode,
  };
}
