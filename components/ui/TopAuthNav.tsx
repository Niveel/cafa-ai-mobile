import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';

import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import { AppButton } from './AppButton';
import { AppLogo } from './AppLogo';
import { MOTION } from '@/utils';

type TopAuthNavProps = {
  authenticatedRightContent?: ReactNode;
};

export function TopAuthNav({ authenticatedRightContent }: TopAuthNavProps) {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const { t } = useI18n();

  return (
    <>
      <Animated.View
        entering={FadeInRight.duration(MOTION.duration.slow)}
        layout={Layout.springify()}
        accessibilityRole="toolbar"
        accessibilityLabel={t('nav.accountActions')}
        className="rounded-full border p-1"
        style={{
          alignSelf: 'stretch',
          width: '100%',
          borderWidth: 1.8,
          borderColor: colors.primary,
          backgroundColor: 'transparent',
        }}
        >
        <View className="flex-row items-center justify-between px-1">
          <View className="flex-row items-center pr-2">
            <View style={{ marginRight: 6 }}>
              <AppLogo size={20} compact showWordmark={false} />
            </View>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }} accessibilityRole="text">
              {t('app.name')}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            {!isAuthenticated ? (
              <>
                <AppButton
                  label={t('auth.login')}
                  onPress={() => router.push('/(auth)/login')}
                  variant="outline"
                  iconName="log-in-outline"
                  minWidth={64}
                  width={82}
                  compact
                />
                <AppButton
                  label={t('auth.signup')}
                  onPress={() => router.push('/(auth)/signup')}
                  variant="solid"
                  iconName="person-add-outline"
                  minWidth={68}
                  width={82}
                  compact
                />
              </>
            ) : (
              authenticatedRightContent
            )}
          </View>
        </View>
      </Animated.View>
    </>
  );
}
