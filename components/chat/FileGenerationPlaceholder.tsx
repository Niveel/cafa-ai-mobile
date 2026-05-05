import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

type FileGenerationPlaceholderProps = {
  width: number;
  height: number;
  isDark: boolean;
  accentColor: string;
};

export function FileGenerationPlaceholder({
  width,
  height,
  isDark,
  accentColor,
}: FileGenerationPlaceholderProps) {
  const shimmerX = useSharedValue(-width);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(width, { duration: 1080 }), -1, false);
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
      className="overflow-hidden rounded-2xl border px-3 py-3"
      style={{
        width,
        height,
        borderColor: isDark ? '#2A2A31' : '#D4D4DC',
        backgroundColor: isDark ? '#0F1016' : '#F6F7FB',
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Generating file artifact"
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
        <View className="mb-2 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${accentColor}22` }}>
          <Ionicons name="document-text-outline" size={18} color={accentColor} />
        </View>
        <ActivityIndicator size="small" color={accentColor} />
        <Text style={{ marginTop: 8, color: isDark ? '#D1D5DB' : '#4B5563', fontSize: 12, fontWeight: '600' }}>
          Generating file...
        </Text>
      </View>
    </View>
  );
}
