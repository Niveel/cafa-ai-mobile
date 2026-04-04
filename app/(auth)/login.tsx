import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppScreen } from '@/components';
import { useAppTheme } from '@/hooks';

export default function LoginScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Login" subtitle="Sign in to continue your Cafa AI conversations." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>
          Login form scaffold is ready for backend wiring. This screen no longer auto-signs users in.
        </Text>
        <AppButton
          label="Verify with OTP"
          iconName="log-in-outline"
          onPress={() => router.push('/(auth)/verify-otp')}
        />
        <AppButton
          label="Create account"
          variant="outline"
          iconName="person-add-outline"
          onPress={() => router.push('/(auth)/signup')}
        />
      </View>
    </AppScreen>
  );
}
