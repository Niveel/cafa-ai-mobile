import { router } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { AppButton, AppForm, AppFormField, AppLogo, AppScreen, SubmitButton } from '@/components';
import { PasswordResetFormValues, PasswordResetValidationSchema } from '@/data';
import { resetPassword as resetPasswordRequest } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { useLocalSearchParams } from 'expo-router';

export default function ResetPasswordScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email?: string; otp?: string }>();
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const initialOtp = typeof params.otp === 'string' ? params.otp : '';

  return (
    <AppScreen title={t('auth.resetPassword')} subtitle={t('auth.resetPasswordSubtitle')} showTopChrome={false}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 10}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-3">
              <AppLogo compact />
              <Text style={{ color: colors.textSecondary }}>{t('auth.resetPasswordBlurb')}</Text>
              <AppForm<PasswordResetFormValues>
                initialValues={{ email: initialEmail, otp: initialOtp, password: '', confirmPassword: '' }}
                validationSchema={PasswordResetValidationSchema}
                onSubmit={async (values) => {
                  setAuthError('');
                  setNotice('');
                  try {
                    const message = await resetPasswordRequest(values.email.trim(), values.otp.trim(), values.password);
                    setNotice(message);
                    router.replace('/(auth)/login');
                  } catch (error) {
                    const mapped = error as { message?: string };
                    setAuthError(mapped?.message ?? t('auth.resetPasswordFailed'));
                  }
                }}
              >
                <AppFormField<PasswordResetFormValues>
                  name="email"
                  label={t('field.email')}
                  placeholder={t('placeholder.email')}
                  type="email"
                  required
                />
                <AppFormField<PasswordResetFormValues>
                  name="otp"
                  label={t('field.verificationCode')}
                  placeholder={t('placeholder.verificationCode')}
                  required
                  maxLength={6}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                />
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
                {notice ? (
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(95,127,184,0.4)' : 'rgba(32,64,121,0.3)',
                      backgroundColor: isDark ? 'rgba(32,64,121,0.18)' : 'rgba(32,64,121,0.1)',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    {notice}
                  </Text>
                ) : null}
                {authError ? (
                  <Text
                    style={{
                      color: isDark ? '#FCA5A5' : '#B91C1C',
                      fontSize: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(251, 113, 133, 0.5)' : 'rgba(220, 38, 38, 0.35)',
                      backgroundColor: isDark ? 'rgba(127, 29, 29, 0.28)' : 'rgba(254, 226, 226, 0.95)',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    {authError}
                  </Text>
                ) : null}
                <SubmitButton title={t('auth.resetPassword')} />
              </AppForm>
              <AppButton label={t('auth.backToLogin')} variant="outline" onPress={() => router.push('/(auth)/login')} />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
