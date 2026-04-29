import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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

import { AppButton, AppForm, AppFormField, AppLogo, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { ForgotPasswordFormValues, ForgotPasswordValidationSchema } from '@/data';
import { forgotPassword as forgotPasswordRequest } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title={t('auth.forgotPassword')} subtitle={t('auth.forgotPasswordSubtitle')} showTopChrome={false} showHeading={false}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 10}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1">
              <SecondaryNav title={t('auth.forgotPassword')} />
              <LinearGradient
                colors={[`${colors.primary}20`, `${colors.secondary}14`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    backgroundColor: cardBackground,
                    padding: 16,
                    gap: 12,
                  }}
                >
                  <AppLogo compact />
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('auth.resetPassword')}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                    {t('auth.resetCodeBlurb')}
                  </Text>
                  <AppForm<ForgotPasswordFormValues>
                    initialValues={{ email: '' }}
                    validationSchema={ForgotPasswordValidationSchema}
                    onSubmit={async (values) => {
                      setAuthError('');
                      setNotice('');
                      const email = values.email.trim();
                      try {
                        const response = await forgotPasswordRequest(email);
                        const message = response?.message ?? '';
                        const devOtp = response?.devOtp || extractDevOtpFromMessage(message);
                        setNotice(devOtp ? `Development verification code: ${devOtp}` : 'If that email is registered, a reset code has been sent');
                        router.push({
                          pathname: '/(auth)/verify-otp',
                          params: { email, flow: 'password-reset', ...(devOtp ? { devOtp } : {}) },
                        });
                      } catch (error) {
                        const mapped = error as { message?: string };
                        const message = mapped?.message ?? t('auth.forgotPasswordFailed');
                        const devOtp = extractDevOtpFromMessage(message);
                        const shouldBypassInDev =
                          __DEV__
                          && message.toLowerCase().includes('email delivery failed');

                        if (devOtp) {
                          setNotice(`Development verification code: ${devOtp}`);
                          router.push({
                            pathname: '/(auth)/verify-otp',
                            params: { email, flow: 'password-reset', devOtp },
                          });
                          return;
                        }
                        if (shouldBypassInDev) {
                          setNotice('If that email is registered, a reset code has been sent');
                          router.push({
                            pathname: '/(auth)/verify-otp',
                            params: { email, flow: 'password-reset' },
                          });
                          return;
                        }
                        setAuthError(message);
                      }
                    }}
                  >
                    <AppFormField<ForgotPasswordFormValues>
                      name="email"
                      label={t('field.email')}
                      placeholder={t('placeholder.email')}
                      type="email"
                      required
                    />
                    {notice ? (
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 12,
                          borderWidth: 1,
                          borderColor: cardBorder,
                          backgroundColor: `${colors.primary}1A`,
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
                    <SubmitButton title={t('auth.sendResetCode')} />
                  </AppForm>
                  <AppButton label={t('auth.backToLogin')} variant="outline" onPress={() => router.push('/(auth)/login')} />
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function extractDevOtpFromMessage(message?: string) {
  if (!__DEV__ || !message) return '';
  const normalized = message.toLowerCase();
  if (!normalized.includes('devotp') && !normalized.includes('dev otp') && !normalized.includes('verification code')) return '';
  const match = message.match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}
