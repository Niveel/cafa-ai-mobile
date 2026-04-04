import { View } from 'react-native';
import { router } from 'expo-router';

import { useAppContext } from '@/context';
import { useAppTheme } from '@/hooks';
import { AppButton } from './AppButton';

export function TopAuthNav() {
  const { isDark } = useAppTheme();
  const { isAuthenticated, signOut } = useAppContext();

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Account actions"
      className="rounded-full border p-1"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        borderColor: 'transparent',
        backgroundColor: isDark ? 'rgba(10, 10, 10, 0.92)' : 'rgba(255, 255, 255, 0.95)',
      }}
    >
      <View className="flex-row items-center gap-1">
        {!isAuthenticated ? (
          <>
            <AppButton
              label="Login"
              onPress={() => router.push('/(auth)/login')}
              variant="outline"
              iconName="log-in-outline"
              minWidth={64}
              width={82}
              compact
            />
            <AppButton
              label="Signup"
              onPress={() => router.push('/(auth)/signup')}
              variant="solid"
              iconName="person-add-outline"
              minWidth={68}
              width={82}
              compact
            />
          </>
        ) : (
          <AppButton
            label="Sign out"
            onPress={() => {
              signOut();
              router.replace('/(drawer)/index');
            }}
            variant="danger"
            iconName="log-out-outline"
            minWidth={84}
            width={102}
            compact
          />
        )}
      </View>
    </View>
  );
}
