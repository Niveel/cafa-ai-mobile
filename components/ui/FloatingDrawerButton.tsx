import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useDrawerStatus } from '@react-navigation/drawer';

import { useAppTheme } from '@/hooks';

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

export function FloatingDrawerButton() {
  const navigation = useNavigation();
  const drawerStatus = useDrawerStatus();
  const { isDark, colors } = useAppTheme();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isDrawerOpen = drawerStatus === 'open';

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setPrefersReducedMotion(enabled);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPrefersReducedMotion(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setPrefersReducedMotion(enabled);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

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
    <View style={shadowStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
        accessibilityHint="Opens the app navigation drawer."
        accessibilityState={{ expanded: isDrawerOpen }}
        accessibilityActions={[{ name: 'activate', label: 'Toggle navigation menu' }]}
        onAccessibilityAction={() => navigation.dispatch(DrawerActions.toggleDrawer())}
        onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
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
          <FancyMenuGlyph />
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
    </View>
  );
}
