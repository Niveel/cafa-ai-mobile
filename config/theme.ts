export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const darkColors: ThemeColors = {
  background: '#020617',
  surface: '#0F172A',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  border: '#1E293B',
  primary: '#38BDF8',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
};

export const colorsByMode: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
