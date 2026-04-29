import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Yup from 'yup';
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
import { useAppTheme, useI18n } from '@/hooks';
import { useAppContext } from '@/context';
import { API_BASE_URL } from '@/lib';
import { apiEndpoints } from '@/services/api';
import { setAccessToken, setRefreshToken } from '@/services';
import {
  claimGuestUpgradeOnLogin,
  forgotPassword as forgotPasswordRequest,
  resendOtp as resendOtpRequest,
  verifyOtp as verifyOtpRequest,
} from '@/features';

type VerifyOtpScreenValues = {
  email: string;
  otp: string;
};

const VerifyOtpScreenValidationSchema = Yup.object().shape({
  email: Yup.string()
    .required('validation.emailRequired')
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'validation.emailInvalid')
    .label('Email'),
  otp: Yup.string().required('validation.otpRequired').matches(/^\d{6}$/, 'validation.otpExact').label('OTP'),
});

export default function VerifyOtpScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const { login } = useAppContext();
  const params = useLocalSearchParams<{ email?: string; flow?: string; devOtp?: string }>();
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');

  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const devOtp = typeof params.devOtp === 'string' && /^\d{6}$/.test(params.devOtp) ? params.devOtp : '';
  const flow = typeof params.flow === 'string' ? params.flow : 'signup';
  const flowMessage =
    flow === 'login'
      ? t('auth.verifyLoginBlurb')
      : flow === 'password-reset'
        ? 'If that email is registered, a reset code has been sent'
        : t('auth.verifySignupBlurb');

  return (
    <AppScreen title={t('auth.verifyOtp')} subtitle={t('auth.verifyOtpSubtitle')} showTopChrome={false} showHeading={false}>
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
              <SecondaryNav title={t('auth.verifyCode')} />
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
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('auth.verifyEmail')}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{flowMessage}</Text>
                  {__DEV__ && devOtp ? (
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
                      Development verification code: {devOtp}
                    </Text>
                  ) : null}
                  <AppForm<VerifyOtpScreenValues>
                    initialValues={{ email: initialEmail, otp: devOtp }}
                    validationSchema={VerifyOtpScreenValidationSchema}
                    onSubmit={async (values) => {
                      setAuthError('');

                      try {
                        if (flow === 'password-reset') {
                          router.push({
                            pathname: '/(auth)/reset-password',
                            params: {
                              email: values.email.trim(),
                              otp: values.otp.trim(),
                            },
                          });
                          return;
                        }

                        const session = await verifyOtpRequest({
                          email: values.email.trim(),
                          otp: values.otp.trim(),
                        });

                        await setAccessToken(session.accessToken);
                        const refreshToken = (session as { refreshToken?: string }).refreshToken;
                        if (refreshToken) {
                          await setRefreshToken(refreshToken);
                        }
                        if (flow === 'login') {
                          await claimGuestUpgradeOnLogin(session.accessToken);
                        }
                        login();
                        router.replace('/(drawer)');
                      } catch (error) {
                        const mapped = error as { message?: string };
                        setAuthError(mapped.message ?? t('auth.verifyFailed'));
                      }
                    }}
                    enableReinitialize
                  >
                    <AppFormField<{ email: string; otp: string }>
                      name="email"
                      label={t('field.email')}
                      placeholder={t('placeholder.email')}
                      type="email"
                      required
                    />
                    <AppFormField<{ email: string; otp: string }>
                      name="otp"
                      label={t('field.verificationCode')}
                      placeholder={t('placeholder.verificationCode')}
                      required
                      maxLength={6}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
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
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('auth.resendCode')}
                      onPress={async () => {
                        setAuthError('');
                        try {
                          const email = initialEmail.trim();
                          if (!email) {
                            setAuthError('Please enter your email to resend the code.');
                            return;
                          }
                          if (flow === 'password-reset') {
                            const response = await forgotPasswordRequest(email);
                            const message = response?.message ?? '';
                            const devOtpFromResponse = response?.devOtp;
                            console.log(
                              `[verify-otp:resend-response] endpoint=${API_BASE_URL}${apiEndpoints.auth.forgotPassword} flow=password-reset email=${email} message="${message}" devOtp="${devOtpFromResponse ?? ''}"`,
                            );
                            if (devOtpFromResponse) {
                              console.log(
                                `[verify-otp:dev-otp] endpoint=${API_BASE_URL}${apiEndpoints.auth.forgotPassword} email=${email} verificationCode=${devOtpFromResponse}`,
                              );
                            }
                            const extractedOtp = devOtpFromResponse || extractDevOtpFromMessage(message);
                            const nextMessage = extractedOtp ? `Development verification code: ${extractedOtp}` : message;
                            setNotice(nextMessage || 'If that email is registered, a reset code has been sent');
                            return;
                          }
                          const response = await resendOtpRequest(email);
                          const message = response?.message ?? '';
                          const devOtpFromResponse = response?.devOtp;
                          console.log(
                            `[verify-otp:resend-response] endpoint=${API_BASE_URL}${apiEndpoints.auth.resendOtp} flow=${flow} email=${email} message="${message}" devOtp="${devOtpFromResponse ?? ''}"`,
                          );
                          if (devOtpFromResponse) {
                            console.log(
                              `[verify-otp:dev-otp] endpoint=${API_BASE_URL}${apiEndpoints.auth.resendOtp} email=${email} verificationCode=${devOtpFromResponse}`,
                            );
                          }
                          const extractedOtp = devOtpFromResponse || extractDevOtpFromMessage(message);
                          const nextMessage = extractedOtp ? `Development verification code: ${extractedOtp}` : message;
                          setNotice(nextMessage || t('auth.resendNotice'));
                        } catch (error) {
                          const mapped = error as { message?: string };
                          const message = mapped?.message ?? t('auth.resendFailed');
                          const extractedOtp = extractDevOtpFromMessage(message);
                          const shouldBypassInDev =
                            __DEV__
                            && flow === 'password-reset'
                            && message.toLowerCase().includes('email delivery failed');
                          if (extractedOtp) {
                            setNotice(`Development verification code: ${extractedOtp}`);
                            return;
                          }
                          if (shouldBypassInDev) {
                            setNotice('If that email is registered, a reset code has been sent');
                            return;
                          }
                          setAuthError(message);
                        }
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ alignSelf: 'flex-start', marginTop: 2 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('auth.resendCode')}</Text>
                    </TouchableOpacity>
                    <View style={{ marginTop: 8 }}>
                      <SubmitButton title={t('auth.verifyAndContinue')} forceEnable />
                    </View>
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
