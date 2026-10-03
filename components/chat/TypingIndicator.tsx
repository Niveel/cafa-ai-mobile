import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * ChatGPT-style waiting indicator: a single dot that breathes (scales and
 * fades) in an assistant bubble before its first token.
 */
export function TypingIndicator({ color, accessibilityLabel }: { color: string; accessibilityLabel: string }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
    transform: [{ scale: 0.8 + pulse.value * 0.35 }],
  }));

  return (
    <View
      className="items-start justify-center py-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }, style]} />
    </View>
  );
}

export default TypingIndicator;
