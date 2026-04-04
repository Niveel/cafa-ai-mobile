import { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/hooks';

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function AppScreen({ title, subtitle, children }: AppScreenProps) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text className="mt-2 text-base" style={{ color: colors.textSecondary }}>
            {subtitle}
          </Text>
        )}
        <View className="mt-8 flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}
