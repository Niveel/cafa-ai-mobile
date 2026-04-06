import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { ForgotPasswordFormValues, ForgotPasswordValidationSchema } from '@/data';
import { useAppTheme } from '@/hooks';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useAppTheme();
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title="Forgot Password" subtitle="Request a reset code for your account." showTopChrome={false} showHeading={false}>
      <View className="flex-1">
        <SecondaryNav title="Forgot password" />
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
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Reset password</Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
              Enter your email and we will send a 6-digit reset code.
            </Text>
            <AppForm<ForgotPasswordFormValues>
              initialValues={{ email: '' }}
              validationSchema={ForgotPasswordValidationSchema}
              onSubmit={(values) =>
                router.push({
                  pathname: '/(auth)/reset-password',
                  params: { email: values.email.trim() },
                })
              }
            >
              <AppFormField<ForgotPasswordFormValues>
                name="email"
                label="Email"
                placeholder="you@example.com"
                type="email"
                required
              />
              <SubmitButton title="Send reset code" />
            </AppForm>
            <AppButton label="Back to login" variant="outline" onPress={() => router.push('/(auth)/login')} />
          </View>
        </LinearGradient>
      </View>
    </AppScreen>
  );
}
