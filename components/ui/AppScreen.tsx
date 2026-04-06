import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks';
import { useAppContext } from '@/context';
import { FloatingDrawerButton } from './FloatingDrawerButton';
import { TopAuthNav } from './TopAuthNav';

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  showTopChrome?: boolean;
  showHeading?: boolean;
};

export function AppScreen({ title, subtitle, children, showTopChrome = true, showHeading = true }: AppScreenProps) {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const insets = useSafeAreaInsets();
  const horizontalPadding = 10;
  const floatingTop = insets.top + 8;
  const contentTop = showTopChrome ? insets.top + 70 : insets.top + (showHeading ? 20 : 8);
  const contentGapTop = showHeading ? (subtitle ? 20 : 8) : 0;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {showTopChrome ? (
        <View
          className="absolute z-20 flex-row items-center"
          style={{ top: floatingTop, left: horizontalPadding, right: horizontalPadding }}
        >
          {isAuthenticated ? <FloatingDrawerButton /> : null}
          <View style={{ marginLeft: isAuthenticated ? 12 : 0, flex: 1, alignItems: 'flex-end' }}>
            <TopAuthNav />
          </View>
        </View>
      ) : null}
      <View className="flex-1 pb-8" style={{ paddingTop: contentTop, paddingHorizontal: horizontalPadding }}>
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
