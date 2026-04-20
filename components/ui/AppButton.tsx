import { Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks';
import { hapticSelection } from '@/utils';

type AppButtonVariant = 'solid' | 'outline' | 'danger';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  minWidth?: number;
  width?: number;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  compact?: boolean;
};

export function AppButton({
  label,
  onPress,
  variant = 'solid',
  minWidth = 74,
  width,
  iconName,
  iconSize = 14,
  compact = false,
}: AppButtonProps) {
  const { colors, isDark } = useAppTheme();
  const resolvedIconName = iconName && Ionicons.glyphMap[iconName] ? iconName : undefined;
  const buttonHeight = compact ? 32 : 36;
  const horizontalPadding = compact ? 10 : 16;
  const textSize = compact ? 12 : 13;
  const resolvedIconSize = compact ? Math.max(12, iconSize - 1) : iconSize;
  const iconGap = compact ? 4 : 6;
  const onPressWithHaptic = () => {
    hapticSelection();
    onPress();
  };

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPressWithHaptic}
        activeOpacity={0.86}
        style={{
          height: buttonHeight,
          minWidth: width ?? minWidth,
          width,
          borderRadius: 999,
          paddingHorizontal: horizontalPadding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#E11D48',
        }}
      >
        {resolvedIconName ? (
          <Ionicons
            name={resolvedIconName}
            size={resolvedIconSize}
            color="#FFFFFF"
            style={{ marginRight: iconGap }}
          />
        ) : null}
        <Text style={{ fontSize: textSize, fontWeight: '600', color: '#FFFFFF' }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'solid') {
    const gradientColors: [string, string] = [colors.primary, colors.secondary];
    const fallbackBackgroundColor = colors.primary;

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPressWithHaptic}
        activeOpacity={0.86}
        style={{
          height: buttonHeight,
          minWidth: width ?? minWidth,
          width,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: fallbackBackgroundColor,
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: '100%',
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: horizontalPadding,
          }}
        >
          {resolvedIconName ? (
            <Ionicons
              name={resolvedIconName}
              size={resolvedIconSize}
              color="#FFFFFF"
              style={{ marginRight: iconGap }}
            />
          ) : null}
          <Text style={{ fontSize: textSize, fontWeight: '600', color: '#FFFFFF' }}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPressWithHaptic}
      activeOpacity={0.86}
      style={{
        height: buttonHeight,
        minWidth: width ?? minWidth,
        width,
        borderRadius: 999,
        paddingHorizontal: horizontalPadding,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#204079',
        backgroundColor: isDark ? 'rgba(10, 10, 10, 0.9)' : 'rgba(255, 255, 255, 0.94)',
      }}
    >
      {resolvedIconName ? (
        <Ionicons
          name={resolvedIconName}
          size={resolvedIconSize}
          color={colors.textPrimary}
          style={{ marginRight: iconGap }}
        />
      ) : null}
      <Text style={{ fontSize: textSize, fontWeight: '600', color: colors.textPrimary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
