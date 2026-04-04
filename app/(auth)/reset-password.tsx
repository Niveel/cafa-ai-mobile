import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppScreen } from '@/components';
import { useAppTheme } from '@/hooks';

export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Reset Password" subtitle="Set a new password for your account." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>
          Reset password scaffold placeholder. Connect to `/auth/reset-password`.
        </Text>
        <AppButton label="Back to login" variant="outline" onPress={() => router.push('/(auth)/login')} />
      </View>
    </AppScreen>
  );
}
