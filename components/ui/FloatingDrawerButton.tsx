import { useEffect, useMemo } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useDrawerStatus } from '@react-navigation/drawer';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useI18n, useReducedMotionPreference } from '@/hooks';
import { MOTION, hapticImpact } from '@/utils';

function FancyMenuGlyph() {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" className="items-center gap-1">
      <View className="flex-row items-center gap-1.5">
        <View className="h-0.5 w-4.5 rounded-full bg-white" />
        <View className="h-1.5 w-1.5 rounded-full bg-white/85" />
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-0.5 w-3.5 rounded-full bg-white/95" />
        <View className="h-1 w-1 rounded-full bg-white/70" />
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-0.5 w-5 rounded-full bg-white" />
        <View className="h-1.5 w-1.5 rounded-full bg-white/85" />
      </View>
    </View>
  );
}

function IosFancyMenuGlyph() {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" className="items-center justify-center">
      <View className="flex-row items-center" style={{ marginBottom: 3 }}>
        <View className="h-0.5 w-6 rounded-full bg-white" />
        <View className="ml-1.5 h-1.5 w-1.5 rounded-full bg-white/85" />
      </View>
      <View className="flex-row items-center" style={{ marginBottom: 3 }}>
        <View className="h-0.5 w-4.5 rounded-full bg-white/95" />
        <View className="ml-1.5 h-1 w-1 rounded-full bg-white/70" />
      </View>
      <View className="flex-row items-center">
        <View className="h-0.5 w-5.5 rounded-full bg-white" />
        <View className="ml-1.5 h-1.5 w-1.5 rounded-full bg-white/85" />
      </View>
    </View>
  );
}

export function FloatingDrawerButton() {
  const navigation = useNavigation();
  const drawerStatus = useDrawerStatus();
  const { isDark, colors } = useAppTheme();
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotionPreference();
  const isDrawerOpen = drawerStatus === 'open';
  const isIos = Platform.OS === 'ios';
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isIos || prefersReducedMotion || isDrawerOpen) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.045, {
          duration: MOTION.duration.slow * 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: MOTION.duration.slow * 2,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [isDrawerOpen, isIos, prefersReducedMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const shadowStyle = useMemo(
    () => ({
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.42 : 0.28,
      shadowRadius: 16,
      elevation: 12,
    }),
    [colors.primary, isDark],
  );

  return (
    <Animated.View style={[shadowStyle, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDrawerOpen ? t('drawer.closeMenu') : t('drawer.openMenu')}
        accessibilityHint={t('drawer.openMenuHint')}
        accessibilityState={{ expanded: isDrawerOpen }}
        accessibilityActions={[{ name: 'activate', label: t('drawer.toggleMenu') }]}
        onAccessibilityAction={() => {
          hapticImpact();
          navigation.dispatch(DrawerActions.toggleDrawer());
        }}
        onPress={() => {
          hapticImpact();
          navigation.dispatch(DrawerActions.toggleDrawer());
        }}
        hitSlop={10}
        className="h-12 w-12 overflow-hidden rounded-full border border-white/30"
        style={({ pressed }) => ({
          transform: [{ scale: prefersReducedMotion ? 1 : pressed ? 0.96 : 1 }],
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <LinearGradient
          colors={
            isDark
              ? [colors.primary, colors.secondary]
              : [colors.primary, colors.secondary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center rounded-full"
        >
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            className="absolute inset-0 rounded-full border border-white/35 bg-white/10"
          />
          {isIos ? <IosFancyMenuGlyph /> : <FancyMenuGlyph />}
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white/80"
          />
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-white/55"
          />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
