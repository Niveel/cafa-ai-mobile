import { ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';

import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import { AppButton } from './AppButton';
import { AppLogo } from './AppLogo';
import { AppPromptModal } from './AppPromptModal';
import { MOTION, hapticImpact } from '@/utils';

type TopAuthNavProps = {
  authenticatedRightContent?: ReactNode;
};

export function TopAuthNav({ authenticatedRightContent }: TopAuthNavProps) {
  const { isDark, colors } = useAppTheme();
  const { isAuthenticated, signOut } = useAppContext();
  const { t } = useI18n();
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false);

  return (
    <>
      <AppPromptModal
        visible={showSignOutPrompt}
        title={t('auth.signoutTitle')}
        message={t('auth.signoutMessage')}
        confirmLabel={t('auth.signoutConfirm')}
        cancelLabel={t('auth.signoutCancel')}
        confirmTone="danger"
        iconName="log-out-outline"
        onCancel={() => setShowSignOutPrompt(false)}
        onConfirm={() => {
          setShowSignOutPrompt(false);
          signOut();
          router.replace('/(drawer)');
        }}
      />

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
          backgroundColor: isDark ? 'rgba(16, 38, 77, 0.28)' : 'rgba(32, 64, 121, 0.08)',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.26 : 0.14,
          shadowRadius: 14,
          elevation: 8,
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
              authenticatedRightContent ?? (
                <AppButton
                  label={t('auth.signout')}
                  onPress={() => {
                    hapticImpact();
                    setShowSignOutPrompt(true);
                  }}
                  variant="danger"
                  iconName="log-out-outline"
                  minWidth={84}
                  width={102}
                  compact
                />
              )
            )}
          </View>
        </View>
      </Animated.View>
    </>
  );
}
