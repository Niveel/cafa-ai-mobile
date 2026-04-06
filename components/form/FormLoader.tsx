import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useAppTheme } from '@/hooks';

export function FormLoader() {
  const { colors, isDark } = useAppTheme();
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    rotateLoop.start();
    pulseLoop.start();

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const orbitColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(124,58,237,0.25)';
  const nodeColor = colors.secondary;

  return (
    <View
      className="items-center justify-center py-2"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityHint="Processing form action"
    >
      <View
        style={{
          height: 64,
          width: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            height: 52,
            width: 52,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: orbitColor,
            transform: [{ rotate: spin }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            height: 36,
            width: 36,
            borderRadius: 18,
            backgroundColor: `${colors.primary}26`,
            borderWidth: 1,
            borderColor: `${colors.primary}70`,
            transform: [{ scale: pulse }],
          }}
        />
        <View
          style={{
            height: 12,
            width: 12,
            borderRadius: 6,
            backgroundColor: colors.primary,
          }}
        />
        <View style={{ position: 'absolute', top: 4, left: 29, height: 6, width: 6, borderRadius: 3, backgroundColor: nodeColor }} />
        <View style={{ position: 'absolute', top: 29, left: 54, height: 6, width: 6, borderRadius: 3, backgroundColor: nodeColor }} />
        <View style={{ position: 'absolute', top: 54, left: 29, height: 6, width: 6, borderRadius: 3, backgroundColor: nodeColor }} />
        <View style={{ position: 'absolute', top: 29, left: 4, height: 6, width: 6, borderRadius: 3, backgroundColor: nodeColor }} />
      </View>
    </View>
  );
}
