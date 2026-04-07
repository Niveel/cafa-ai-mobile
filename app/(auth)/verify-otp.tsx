import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Yup from 'yup';
import { Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppLogo, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import { useAppContext } from '@/context';
import { setAccessToken, setRefreshToken } from '@/services';
import { verifyOtp as verifyOtpRequest } from '@/features';

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
  const params = useLocalSearchParams<{ email?: string; flow?: string }>();
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');

  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const flow = typeof params.flow === 'string' ? params.flow : 'signup';
  const flowMessage =
    flow === 'login' ? t('auth.verifyLoginBlurb') : t('auth.verifySignupBlurb');

  return (
    <AppScreen title={t('auth.verifyOtp')} subtitle={t('auth.verifyOtpSubtitle')} showTopChrome={false} showHeading={false}>
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
            <AppForm<VerifyOtpScreenValues>
              initialValues={{ email: initialEmail, otp: '' }}
              validationSchema={VerifyOtpScreenValidationSchema}
              onSubmit={async (values) => {
                setAuthError('');

                try {
                  const session = await verifyOtpRequest({
                    email: values.email.trim(),
                    otp: values.otp.trim(),
                  });

                  await setAccessToken(session.accessToken);
                  const refreshToken = (session as { refreshToken?: string }).refreshToken;
                  if (refreshToken) {
                    await setRefreshToken(refreshToken);
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
              <View className="flex-row items-center justify-between">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.resendCode')}
                  onPress={() => setNotice(t('auth.resendNotice'))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('auth.resendCode')}</Text>
                </TouchableOpacity>
                <SubmitButton title={t('auth.verifyAndContinue')} forceEnable />
              </View>
            </AppForm>
            <AppButton label={t('auth.backToLogin')} variant="outline" onPress={() => router.push('/(auth)/login')} />
          </View>
        </LinearGradient>
      </View>
    </AppScreen>
  );
}
