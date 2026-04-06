import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { AppButton, AppForm, AppFormField, AppScreen, SecondaryNav, SubmitButton } from '@/components';
import { SignupFormValues, SignupValidationSchema } from '@/data';
import { useAppTheme, useI18n } from '@/hooks';

export default function SignupScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
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
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('auth.signup')}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                    {t('auth.signupBlurb')}
                  </Text>
                  <AppForm<SignupFormValues>
                    initialValues={{ username: '', email: '', password: '', confirmPassword: '' }}
                    validationSchema={SignupValidationSchema}
                    onSubmit={(values) =>
                      router.push({
                        pathname: '/(auth)/verify-otp',
                        params: {
                          email: values.email.trim(),
                          flow: 'signup',
                        },
                      })
                    }
                  >
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
