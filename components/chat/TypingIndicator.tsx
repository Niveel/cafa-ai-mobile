import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Three pulsing dots shown in an assistant bubble before its first token,
 * replacing the old "." / ".." / "..." text cycle.
 */
const Dot = ({ delay, color }: { delay: number; color: string }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.3, { duration: 360 })), -1, false),
    );
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 3.5, marginHorizontal: 2.5, backgroundColor: color }, style]}
    />
  );
};

export function TypingIndicator({ color, accessibilityLabel }: { color: string; accessibilityLabel: string }) {
  return (
    <View
      className="flex-row items-center py-1.5"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <Dot delay={0} color={color} />
      <Dot delay={180} color={color} />
      <Dot delay={360} color={color} />
    </View>
  );
}

export default TypingIndicator;
