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

function WaveBar({ color, delay }: { color: string; delay: number }) {
  const scale = useSharedValue(0.45);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.45, { duration: 340, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 22,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.9,
        },
        animatedStyle,
      ]}
    />
  );
}

export function RecordingWaves({ color }: { color: string }) {
  return (
    <View className="h-7 flex-row items-center gap-1.5">
      <WaveBar color={color} delay={0} />
      <WaveBar color={color} delay={90} />
      <WaveBar color={color} delay={180} />
      <WaveBar color={color} delay={270} />
      <WaveBar color={color} delay={360} />
    </View>
  );
}
