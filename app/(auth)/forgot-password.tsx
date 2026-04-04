import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppScreen } from '@/components';
import { useAppTheme } from '@/hooks';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Forgot Password" subtitle="Request a reset code for your account." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>
          Forgot password scaffold placeholder. Connect to `/auth/forgot-password`.
        </Text>
        <AppButton label="Reset password" onPress={() => router.push('/(auth)/reset-password')} />
      </View>
    </AppScreen>
  );
}
