import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type ImageGenerationPlaceholderProps = {
  width: number;
  height: number;
  isDark: boolean;
  accentColor: string;
};

export function ImageGenerationPlaceholder({
  width,
  height,
  isDark,
  accentColor,
}: ImageGenerationPlaceholderProps) {
  const shimmerX = useSharedValue(-width);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(width, { duration: 1100 }), -1, false);
    pulse.value = withRepeat(withTiming(0.9, { duration: 760 }), -1, true);
  }, [height, pulse, shimmerX, width]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{
        width,
        height,
        borderColor: isDark ? '#2A2A31' : '#D4D4DC',
        backgroundColor: isDark ? '#0F1016' : '#F6F7FB',
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Generating image preview"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            backgroundColor: isDark ? '#181A24' : '#E8ECFA',
          },
          pulseStyle,
        ]}
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: Math.max(72, Math.floor(width * 0.26)),
            backgroundColor: `${accentColor}2B`,
          },
          shimmerStyle,
        ]}
      />

      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    </View>
  );
}

