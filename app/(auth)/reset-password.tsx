import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppScreen, SubmitButton } from '@/components';
import { PasswordResetFormValues, PasswordResetValidationSchema } from '@/data';
import { useAppTheme } from '@/hooks';

export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen title="Reset Password" subtitle="Set a new password for your account." showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>Set your new password and confirm it.</Text>
        <AppForm<PasswordResetFormValues>
          initialValues={{ password: '', confirmPassword: '' }}
          validationSchema={PasswordResetValidationSchema}
          onSubmit={() => router.push('/(auth)/login')}
        >
          <AppFormField<PasswordResetFormValues>
            name="password"
            label="New Password"
            placeholder="Enter new password"
            type="password"
            required
          />
          <AppFormField<PasswordResetFormValues>
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Re-enter new password"
            type="password"
            required
          />
          <SubmitButton title="Reset password" />
        </AppForm>
        <AppButton label="Back to login" variant="outline" onPress={() => router.push('/(auth)/login')} />
      </View>
    </AppScreen>
  );
}
