import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppScreen } from '@/components';
import { useAppTheme } from '@/hooks';

export default function SignupScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Signup" subtitle="Create your Cafa AI account." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>
          Signup flow scaffold is ready for backend form wiring.
        </Text>
        <AppButton
          label="Continue to verification"
          iconName="person-add-outline"
          onPress={() => router.push('/(auth)/verify-otp')}
        />
        <AppButton
          label="Back to login"
          variant="outline"
          iconName="arrow-back-outline"
          onPress={() => router.push('/(auth)/login')}
        />
      </View>
    </AppScreen>
  );
}
