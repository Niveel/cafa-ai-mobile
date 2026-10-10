import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/hooks';
import { hapticSelection } from '@/utils';

import type { StudioIconName } from '../studioIconNames';
import { StudioIcon } from './StudioIcon';
import { useStudioPalette } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'danger';
  /** Lucide glyph before the label, or after it with iconAfter (Continue buttons end with arrow-right). */
  icon?: StudioIconName;
  iconAfter?: boolean;
  loading?: boolean;
  /** Shown instead of label while loading (web: Saving..., Creating project...). */
  loadingLabel?: string;
  disabled?: boolean;
  compact?: boolean;
};

/**
 * Movie Studio button: Lucide icon, and a spinning loader-circle while busy, as on web.
 * Built like the app's AppButton (static sizes on a TouchableOpacity): a fixed height and a content-sized width,
 * so it never stretches with its parent.
 */
export function StudioButton({
  label,
  onPress,
  variant = 'solid',
  icon,
  iconAfter = false,
  loading = false,
  loadingLabel,
  disabled = false,
  compact = false,
}: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const inactive = disabled || loading;
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  const textColor = solid ? '#FFFFFF' : danger ? '#EF4444' : colors.textPrimary;
  const shownLabel = loading && loadingLabel ? loadingLabel : label;
  const glyph: StudioIconName | null = loading ? 'loader-circle' : (icon ?? null);
  const iconSize = compact ? 14 : 16;
  const height = compact ? 36 : 44; // 44 dp keeps the touch target accessible
  const paddingHorizontal = compact ? 12 : 18;

  const content = (
    <>
      {glyph && (!iconAfter || loading) ? <StudioIcon name={glyph} size={iconSize} color={textColor} /> : null}
      <Text
        numberOfLines={1}
        style={{ color: textColor, fontSize: compact ? 12 : 13, fontWeight: '600', marginHorizontal: glyph ? 6 : 0, flexShrink: 1 }}
      >
        {shownLabel}
      </Text>
      {glyph && iconAfter && !loading ? <StudioIcon name={glyph} size={iconSize} color={textColor} /> : null}
    </>
  );

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      activeOpacity={0.86}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={{
        height,
        minWidth: 64,
        maxWidth: '100%',
        borderRadius: 999,
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
        borderWidth: solid ? 0 : 1,
        borderColor: danger ? '#EF4444' : P.border,
        backgroundColor: solid ? P.accent : 'transparent',
      }}
    >
      {solid ? (
        <LinearGradient
          colors={[P.gradient[0], P.gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={{ height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal }}>
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}
