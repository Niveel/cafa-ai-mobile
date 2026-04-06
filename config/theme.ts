export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  accent2: string;
  success: string;
  warning: string;
  danger: string;
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  textPrimary: '#171717',
  textSecondary: '#8A8A8A',
  border: 'rgba(0, 0, 0, 0.15)',
  primary: '#7C3AED',
  secondary: '#8B5CF6',
  accent: '#6D28D9',
  accent2: '#A78BFA',
  success: '#78A50F',
  warning: '#F9C70F',
  danger: '#DC2626',
};

export const darkColors: ThemeColors = {
  background: '#000000',
  surface: '#0A0A0A',
  textPrimary: '#FFFFFF',
  textSecondary: '#8C8C8C',
  border: 'rgba(255, 255, 255, 0.2)',
  primary: '#8B5CF6',
  secondary: '#7C3AED',
  accent: '#A78BFA',
  accent2: '#6D28D9',
  success: '#CDDC39',
  warning: '#F9C70F',
  danger: '#FB7185',
};

export const colorsByMode: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
