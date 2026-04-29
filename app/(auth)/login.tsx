import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { AppButton, AppForm, AppFormField, AppLogo, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { LoginFormValues, LoginValidationSchema } from '@/data';
import { claimGuestUpgradeOnLogin, login as loginRequest } from '@/features';
import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { apiEndpoints } from '@/services/api';
import { setAccessToken, setRefreshToken } from '@/services';

export default function LoginScreen() {
  const { colors, isDark } = useAppTheme();
  const { login } = useAppContext();
  const { t } = useI18n();
  const [authError, setAuthError] = useState('');
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title={t('auth.login')} subtitle={t('auth.loginSubtitle')} showTopChrome={false} showHeading={false}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1">
              <SecondaryNav title={t('auth.login')} />
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
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('auth.login')}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                    {t('auth.loginBlurb')}
                  </Text>
                  <AppForm<LoginFormValues>
                    initialValues={{ emailOrUsername: '', password: '' }}
                    validationSchema={LoginValidationSchema}
                    onSubmit={async (values) => {
                      setAuthError('');
                      const identity = values.emailOrUsername.trim();

                      try {
                        const session = await loginRequest({
                          email: identity,
                          password: values.password,
                        });

                        await setAccessToken(session.accessToken);
                        const refreshToken = (session as { refreshToken?: string }).refreshToken;
                        if (refreshToken) {
                          await setRefreshToken(refreshToken);
                        }
                        await claimGuestUpgradeOnLogin(session.accessToken);
                        login();
                        router.replace('/(drawer)');
                      } catch (error) {
                        const mapped = error as { code?: string; status?: number; message?: string };
                        const message = mapped?.message ?? t('auth.signinFailed');
                        const code = mapped?.code ?? '';
                        const devOtp = extractDevOtpFromMessage(message);
                        console.log(
                          `[login-screen:error] endpoint=${API_BASE_URL}${apiEndpoints.auth.login} code=${mapped?.code ?? 'unknown'} status=${mapped?.status ?? 'unknown'} message="${message}"`,
                        );

                        if (code === 'EMAIL_NOT_VERIFIED') {
                          router.push({
                            pathname: '/(auth)/verify-otp',
                            params: {
                              email: identity,
                              flow: 'login',
                              ...(devOtp ? { devOtp } : {}),
                            },
                          });
                          return;
                        }

                        setAuthError(message);
                      }
                    }}
                  >
                    <AppFormField<LoginFormValues>
                      name="emailOrUsername"
                      label={t('field.emailOrUsername')}
                      placeholder={t('placeholder.emailOrUsername')}
                      autoComplete="username"
                      textContentType="username"
                      autoCapitalize="none"
                      autoCorrect={false}
                      required
                    />
                    <AppFormField<LoginFormValues>
                      name="password"
                      label={t('field.password')}
                      placeholder={t('placeholder.enterPassword')}
                      type="password"
                      autoComplete="password"
                      textContentType="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      required
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('auth.forgotPassword')}
                      onPress={() => router.push('/(auth)/forgot-password')}
                      style={{ alignSelf: 'flex-end', marginTop: -4 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('auth.forgotPasswordCta')}</Text>
                    </TouchableOpacity>
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
                    <SubmitButton title={t('common.continue')} />
                  </AppForm>
                  <AppButton
                    label={t('auth.signup')}
                    variant="outline"
                    iconName="person-add-outline"
                    onPress={() => router.push('/(auth)/signup')}
                  />
                </View>
              </LinearGradient>
              <View className="mt-4 px-2">
                <View className="flex-row flex-wrap items-center justify-center">
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
                    {t('auth.termsPrefix')}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('drawer.userMenu.terms')}
                    onPress={() => router.push('/(drawer)/terms-of-service')}
                    className="mx-1"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: '700',
                        textDecorationLine: 'underline',
                      }}
                    >
                      {t('drawer.userMenu.terms')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
                    {t('auth.termsAnd')}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('drawer.userMenu.privacy')}
                    onPress={() => router.push('/(drawer)/privacy-policy')}
                    className="mx-1"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: '700',
                        textDecorationLine: 'underline',
                      }}
                    >
                      {t('drawer.userMenu.privacy')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
                    {t('auth.termsSuffix')}
                  </Text>
                </View>
              </View>
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
