import { useCallback, useEffect, useRef } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';

import { useAppContext } from '@/context';
import { useReducedMotionPreference } from '@/hooks';
import { hapticSelection } from '@/utils';

type CafaLiveToggleProps = {
  isDark: boolean;
  onLongPress?: (event: GestureResponderEvent) => void;
};

const TRACK_WIDTH = 60;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 24;
const KNOB_INSET = 3;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;
const OPEN_DELAY_MS = 260;

// Composer switch into Cafa Live. Flipping it on slides the knob across, then opens the Cafa Live
// screen; it flips back off whenever the chat screen regains focus.
export function CafaLiveToggle({ isDark, onLongPress }: CafaLiveToggleProps) {
  const { colors, t } = useAppContext();
  const prefersReducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpeningRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [prefersReducedMotion, pulse]);

  useFocusEffect(
    useCallback(() => {
      isOpeningRef.current = false;
      progress.value = prefersReducedMotion ? 0 : withTiming(0, { duration: 180 });
      return () => {
        if (openTimeoutRef.current) {
          clearTimeout(openTimeoutRef.current);
          openTimeoutRef.current = null;
        }
      };
    }, [prefersReducedMotion, progress]),
  );

  const handlePress = () => {
    if (isOpeningRef.current) return;
    isOpeningRef.current = true;
    hapticSelection();
    progress.value = prefersReducedMotion ? 1 : withSpring(1, { damping: 16, stiffness: 220, mass: 0.7 });
    openTimeoutRef.current = setTimeout(() => {
      openTimeoutRef.current = null;
      void router.push('/cafa-life');
    }, prefersReducedMotion ? 0 : OPEN_DELAY_MS);
  };

  const offTrack = isDark ? '#1A1A1A' : '#F1F5F9';
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offTrack, colors.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * KNOB_TRAVEL }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]) * (1 - progress.value),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.7]) }],
  }));

  const offLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const onLabelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: false }}
      accessibilityLabel={t('chat.cafaLive.toggleLabel')}
      accessibilityHint={t('chat.cafaLive.toggleHint')}
      hitSlop={4}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            borderWidth: 1,
            justifyContent: 'center',
          },
          trackStyle,
        ]}
      >
        <Animated.Text
          style={[
            { position: 'absolute', right: 8, fontSize: 10, fontWeight: '700', color: colors.textSecondary },
            offLabelStyle,
          ]}
        >
          {t('chat.cafaLive.short')}
        </Animated.Text>
        <Animated.Text
          style={[
            { position: 'absolute', left: 9, fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
            onLabelStyle,
          ]}
        >
          {t('chat.cafaLive.short')}
        </Animated.Text>

        <Animated.View
          style={[
            {
              position: 'absolute',
              left: KNOB_INSET,
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            },
            knobStyle,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: KNOB_SIZE,
                height: KNOB_SIZE,
                borderRadius: KNOB_SIZE / 2,
                backgroundColor: colors.primary,
              },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={{
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              borderRadius: KNOB_SIZE / 2,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000000',
              shadowOpacity: 0.18,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            }}
          >
            <Ionicons name="radio-outline" size={13} color={colors.primary} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
