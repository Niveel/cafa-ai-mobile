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
import { SignupFormValues, SignupValidationSchema } from '@/data';
import { signup as signupRequest } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { apiEndpoints } from '@/services/api';

export default function SignupScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const [authError, setAuthError] = useState('');
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title={t('auth.signup')} subtitle={t('auth.signupSubtitle')} showTopChrome={false} showHeading={false}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1">
              <SecondaryNav title={t('auth.createAccount')} />
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
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('auth.signup')}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 18, fontSize: 13 }}>
                    {t('auth.signupBlurb')}
                  </Text>
                  <AppForm<SignupFormValues>
                    initialValues={{ name: '', username: '', email: '', password: '', confirmPassword: '' }}
                    validationSchema={SignupValidationSchema}
                    onSubmit={async (values) => {
                      setAuthError('');
                      const email = values.email.trim();
                      const name = values.name.trim();
                      const username = values.username.trim();

                      try {
                        await signupRequest({
                          username,
                          name,
                          email,
                          password: values.password,
                        });
                        router.push({
                          pathname: '/(auth)/verify-otp',
                          params: {
                            email,
                            flow: 'signup',
                          },
                        });
                      } catch (error) {
                        const mapped = error as { code?: string; status?: number; message?: string };
                        const code = (mapped?.code ?? '').toUpperCase();
                        const message = mapped?.message ?? t('auth.signupFailed');
                        const devOtp = extractDevOtpFromMessage(message);
                        const isEmailConflict =
                          mapped?.status === 409 ||
                          code.includes('EMAIL') ||
                          code.includes('EXIST') ||
                          code.includes('CONFLICT') ||
                          message.toLowerCase().includes('already exists');

                        const finalMessage = isEmailConflict
                          ? 'A user with this email already exists'
                          : message;

                        console.log(
                          `[signup-screen:error] endpoint=${API_BASE_URL}${apiEndpoints.auth.register} code=${mapped?.code ?? 'unknown'} status=${mapped?.status ?? 'unknown'} message="${message}"`,
                        );
                        if (devOtp) {
                          router.push({
                            pathname: '/(auth)/verify-otp',
                            params: {
                              email,
                              flow: 'signup',
                              devOtp,
                            },
                          });
                          return;
                        }
                        setAuthError(finalMessage);
                      }
                    }}
                  >
                    <AppFormField<SignupFormValues> name="name" label={t('help.formName')} placeholder={t('help.formNamePlaceholder')} required />
                    <AppFormField<SignupFormValues> name="username" label={t('field.username')} placeholder={t('placeholder.username')} required />
                    <AppFormField<SignupFormValues> name="email" label={t('field.email')} placeholder={t('placeholder.email')} required />
                    <AppFormField<SignupFormValues>
                      name="password"
                      label={t('field.password')}
                      placeholder={t('placeholder.createPassword')}
                      type="password"
                      required
                    />
                    <AppFormField<SignupFormValues>
                      name="confirmPassword"
                      label={t('field.confirmPassword')}
                      placeholder={t('placeholder.confirmPassword')}
                      type="password"
                      required
                    />
                    {authError ? (
                      <View
                        className="rounded-xl border px-3 py-2"
                        style={{
                          borderColor: isDark ? 'rgba(251, 113, 133, 0.5)' : 'rgba(220, 38, 38, 0.35)',
                          backgroundColor: isDark ? 'rgba(127, 29, 29, 0.28)' : 'rgba(254, 226, 226, 0.95)',
                        }}
                      >
                        <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: 12 }}>{authError}</Text>
                      </View>
                    ) : null}
                    <SubmitButton title={t('auth.createAccount')} />
                  </AppForm>
                  <AppButton
                    label={t('auth.backToLogin')}
                    variant="outline"
                    iconName="arrow-back-outline"
                    onPress={() => router.push('/(auth)/login')}
                  />
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
