import { ReactNode, useCallback } from 'react';
import { BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks';
import { useAppContext } from '@/context';
import { FloatingDrawerButton } from './FloatingDrawerButton';
import { TopAuthNav } from './TopAuthNav';

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  topAuthRightContent?: ReactNode;
  showTopChrome?: boolean;
  showHeading?: boolean;
  topChromeOffset?: number;
  contentTopOffset?: number;
  /**
   * Real fix: screens reached from a hub (Tools, Repo, or another tool)
   * only ever showed the drawer-toggle in this slot. Android's hardware
   * back button on a Drawer navigator doesn't unwind per-screen history
   * the way a Stack does -- it drops straight to the drawer's initial
   * route (chat) regardless of how the user actually got here. Passing
   * this makes that slot a real back button to the correct parent list
   * instead, and wires the same target into the hardware back button so
   * both agree. Omit it on hub screens reached directly from the drawer
   * sidebar (Tools, Repo, chat) to keep their current menu-only header.
   */
  onBackPress?: () => void;
};

export function AppScreen({
  title,
  subtitle,
  children,
  topAuthRightContent,
  showTopChrome = true,
  showHeading = true,
  topChromeOffset = 0,
  contentTopOffset = 0,
  onBackPress,
}: AppScreenProps) {
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (!onBackPress) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBackPress();
        return true;
      });
      return () => subscription.remove();
    }, [onBackPress]),
  );

  const horizontalPadding = 10;
  const topChromeGap = Platform.OS === 'ios' ? 4 : 12;
  const floatingTop = insets.top + 4 + topChromeOffset;
  const contentTop = showTopChrome
    ? insets.top + 70 + topChromeOffset + contentTopOffset
    : insets.top + (showHeading ? 20 : 8);
  const contentGapTop = showHeading ? (subtitle ? 20 : 8) : 0;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {showTopChrome ? (
        <View
          className="absolute z-20 flex-row items-center"
          style={{ top: floatingTop, left: horizontalPadding, right: horizontalPadding }}
        >
          {isAuthenticated ? (
            onBackPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={onBackPress}
                hitSlop={10}
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(32,64,121,0.26)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(32,64,121,0.08)',
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </Pressable>
            ) : (
              <FloatingDrawerButton />
            )
          ) : null}
          <View style={{ marginLeft: isAuthenticated ? topChromeGap : 0, flex: 1, alignItems: 'flex-end' }}>
            <TopAuthNav authenticatedRightContent={topAuthRightContent} />
          </View>
        </View>
      ) : null}
      <View
        className="flex-1"
        style={{
          paddingTop: contentTop,
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom + 8, 16),
        }}
      >
        {showHeading ? (
          <>
            <Text
              accessibilityRole="header"
              className="text-2xl font-semibold"
              style={{ color: colors.textPrimary }}
              maxFontSizeMultiplier={1.8}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text className="mt-2 text-base" style={{ color: colors.textSecondary }} maxFontSizeMultiplier={1.9}>
                {subtitle}
              </Text>
            )}
          </>
        ) : null}
        <View className="flex-1" style={{ marginTop: contentGapTop }}>
          {children}
        </View>
      </View>
    </View>
  );
}
