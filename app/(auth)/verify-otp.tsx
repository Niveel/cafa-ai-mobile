import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Yup from 'yup';
import { Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { useAppTheme } from '@/hooks';
import { useAppContext } from '@/context';

type VerifyOtpScreenValues = {
  email: string;
  otp: string;
};

const VerifyOtpScreenValidationSchema = Yup.object().shape({
  email: Yup.string()
    .required('Email is required')
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'Please enter a valid email address')
    .label('Email'),
  otp: Yup.string().required('OTP is required').matches(/^\d{6}$/, 'OTP must be exactly 6 digits').label('OTP'),
});

export default function VerifyOtpScreen() {
  const { colors, isDark } = useAppTheme();
  const { login } = useAppContext();
  const params = useLocalSearchParams<{ email?: string; flow?: string }>();
  const [notice, setNotice] = useState('');

  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const flow = typeof params.flow === 'string' ? params.flow : 'signup';
  const flowMessage =
    flow === 'login' ? 'Confirm your email to finish logging in.' : 'Confirm your email to activate your new account.';

  return (
    <AppScreen title="Verify OTP" subtitle="Confirm your email with the one-time passcode." showTopChrome={false} showHeading={false}>
      <View className="flex-1">
        <SecondaryNav title="Verify code" />
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
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Verify your email</Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{flowMessage}</Text>
            <AppForm<VerifyOtpScreenValues>
              initialValues={{ email: initialEmail, otp: '' }}
              validationSchema={VerifyOtpScreenValidationSchema}
              onSubmit={() => {
                login();
                router.replace('/(drawer)');
              }}
              enableReinitialize
            >
              <AppFormField<{ email: string; otp: string }>
                name="email"
                label="Email"
                placeholder="you@example.com"
                type="email"
                required
              />
              <AppFormField<{ email: string; otp: string }>
                name="otp"
                label="Verification code"
                placeholder="123456"
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
              <View className="flex-row items-center justify-between">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Resend verification code"
                  onPress={() => setNotice('A new verification code has been sent to your email.')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Resend code</Text>
                </TouchableOpacity>
                <SubmitButton title="Verify and continue" forceEnable />
              </View>
            </AppForm>
            <AppButton label="Back to login" variant="outline" onPress={() => router.push('/(auth)/login')} />
          </View>
        </LinearGradient>
      </View>
    </AppScreen>
  );
}
