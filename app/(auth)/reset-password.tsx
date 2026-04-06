import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppScreen, SubmitButton } from '@/components';
import { PasswordResetFormValues, PasswordResetValidationSchema } from '@/data';
import { useAppTheme, useI18n } from '@/hooks';

export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <AppScreen title={t('auth.resetPassword')} subtitle={t('auth.resetPasswordSubtitle')} showTopChrome={false}>
      <View className="gap-3">
        <Text style={{ color: colors.textSecondary }}>{t('auth.resetPasswordBlurb')}</Text>
        <AppForm<PasswordResetFormValues>
          initialValues={{ password: '', confirmPassword: '' }}
          validationSchema={PasswordResetValidationSchema}
          onSubmit={() => router.push('/(auth)/login')}
        >
          <AppFormField<PasswordResetFormValues>
            name="password"
            label={t('field.newPassword')}
            placeholder={t('placeholder.newPassword')}
            type="password"
            required
          />
          <AppFormField<PasswordResetFormValues>
            name="confirmPassword"
            label={t('field.confirmPassword')}
            placeholder={t('placeholder.confirmNewPassword')}
            type="password"
            required
          />
          <SubmitButton title={t('auth.resetPassword')} />
        </AppForm>
        <AppButton label={t('auth.backToLogin')} variant="outline" onPress={() => router.push('/(auth)/login')} />
      </View>
    </AppScreen>
  );
}
