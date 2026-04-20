import { Image, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks';

type AppLogoProps = {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
};

export function AppLogo({ size = 34, showWordmark = true, compact = false }: AppLogoProps) {
  const { colors, isDark } = useAppTheme();
  const boxSize = size + 14;

  return (
    <View className="flex-row items-center">
      <View
        className="items-center justify-center overflow-hidden rounded-2xl"
        style={{
          width: boxSize,
          height: boxSize,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(95,127,184,0.36)' : 'rgba(32,64,121,0.28)',
          backgroundColor: isDark ? 'rgba(95,127,184,0.14)' : 'rgba(32,64,121,0.1)',
        }}
      >
        <Image
          source={require('../../assets/images/logo.png')}
          style={{ width: boxSize, height: boxSize }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      {showWordmark ? (
        <Text
          style={{
            marginLeft: compact ? 8 : 10,
            color: colors.textPrimary,
            fontSize: compact ? 16 : 18,
            fontWeight: '800',
          }}
        >
          Cafa AI
        </Text>
      ) : null}
    </View>
  );
}
