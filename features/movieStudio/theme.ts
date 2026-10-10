import { useAppTheme } from '@/hooks';

/** Icons and spinners keep the original Movie Studio violet; everything else follows the app's navy palette (config/theme.ts). */
export const ICON = '#9333EA';

export type StudioPalette = {
  /** Fills and selected borders: buttons, chips, progress bars. */
  accent: string;
  /** Accent-coloured text, readable on the card surface. */
  accentText: string;
  /** Card and panel background. */
  surface: string;
  /** Bottom sheets and menus. */
  sheet: string;
  /** Text input background. */
  inputBg: string;
  /** Card and field borders. */
  border: string;
  /** Solid button gradient. */
  gradient: readonly [string, string];
};

const DARK: StudioPalette = {
  accent: '#2B4F8E',
  accentText: '#8FAEDF',
  surface: '#0B1426',
  sheet: '#0A1220',
  inputBg: '#08101E',
  border: 'rgba(95, 127, 184, 0.35)',
  gradient: ['#2B4F8E', '#204079'],
};

const LIGHT: StudioPalette = {
  accent: '#204079',
  accentText: '#204079',
  surface: '#F2F6FC',
  sheet: '#FFFFFF',
  inputBg: '#FFFFFF',
  border: 'rgba(32, 64, 121, 0.22)',
  gradient: ['#2B4F8E', '#204079'],
};

export function useStudioPalette(): StudioPalette {
  const { isDark } = useAppTheme();
  return isDark ? DARK : LIGHT;
}
