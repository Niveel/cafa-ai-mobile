import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppScreen } from '@/components';
import { useAppTheme } from '@/hooks';

export default function VerifyOtpScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Verify OTP" subtitle="Confirm your email with the one-time passcode." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>
          OTP input scaffold placeholder. Connect to `/auth/verify-otp`.
        </Text>
        <AppButton label="Back to login" variant="outline" onPress={() => router.push('/(auth)/login')} />
      </View>
    </AppScreen>
  );
}
