import { memo, useEffect } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * ChatGPT-style "working" caption: plain text with a soft highlight that
 * sweeps left to right, no chip, border or spinner. Each character dims and
 * brightens from one shared progress value, which gives the sweep without a
 * masked-view dependency.
 */
const SWEEP_DURATION_MS = 1700;
const DIM_OPACITY = 0.38;
const SWEEP_WIDTH = 0.22;

type ShimmerCharProps = {
  char: string;
  position: number;
  progress: { value: number };
  color: string;
  textStyle: StyleProp<TextStyle>;
};

const ShimmerChar = memo(({ char, position, progress, color, textStyle }: ShimmerCharProps) => {
  const style = useAnimatedStyle(() => {
    const center = -0.2 + progress.value * 1.4;
    const distance = Math.abs(position - center);
    const glow = Math.max(0, 1 - distance / SWEEP_WIDTH);
    return { opacity: DIM_OPACITY + (1 - DIM_OPACITY) * glow };
  });

  return (
    <Animated.Text style={[textStyle, { color }, style]}>{char === ' ' ? ' ' : char}</Animated.Text>
  );
});
ShimmerChar.displayName = 'ShimmerChar';

type ShimmerTextProps = {
  text: string;
  color: string;
  fontSize?: number;
  fontWeight?: TextStyle['fontWeight'];
};

export function ShimmerText({ text, color, fontSize = 15, fontWeight = '500' }: ShimmerTextProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.linear }), -1, false);
    return () => {
      progress.value = 0;
    };
  }, [progress, reduceMotion, text]);

  const textStyle: TextStyle = { fontSize, fontWeight, lineHeight: Math.round(fontSize * 1.4) };

  if (reduceMotion) {
    return (
      <Text accessibilityLiveRegion="polite" style={[textStyle, { color }]}>
        {text}
      </Text>
    );
  }

  const chars = Array.from(text);
  const last = Math.max(chars.length - 1, 1);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
    >
      {chars.map((char, index) => (
        <ShimmerChar
          key={`${index}-${char}`}
          char={char}
          position={index / last}
          progress={progress}
          color={color}
          textStyle={textStyle}
        />
      ))}
    </View>
  );
}

export default ShimmerText;
