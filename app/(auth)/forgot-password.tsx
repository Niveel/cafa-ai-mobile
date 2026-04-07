import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { AppButton, AppForm, AppFormField, AppLogo, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { ForgotPasswordFormValues, ForgotPasswordValidationSchema } from '@/data';
import { useAppTheme, useI18n } from '@/hooks';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title={t('auth.forgotPassword')} subtitle={t('auth.forgotPasswordSubtitle')} showTopChrome={false} showHeading={false}>
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
              onSubmit={(values) =>
                router.push({
                  pathname: '/(auth)/reset-password',
                  params: { email: values.email.trim() },
                })
              }
            >
              <AppFormField<ForgotPasswordFormValues>
                name="email"
                label={t('field.email')}
                placeholder={t('placeholder.email')}
                type="email"
                required
              />
              <SubmitButton title={t('auth.sendResetCode')} />
            </AppForm>
            <AppButton label={t('auth.backToLogin')} variant="outline" onPress={() => router.push('/(auth)/login')} />
          </View>
        </LinearGradient>
      </View>
    </AppScreen>
  );
}
