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
import { useAppTheme } from '@/hooks';

export default function SignupScreen() {
  const { colors, isDark } = useAppTheme();
  const cardBackground = isDark ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(124, 58, 237, 0.24)';

  return (
    <AppScreen title="Signup" subtitle="Create your Cafa AI account." showTopChrome={false} showHeading={false}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1">
              <SecondaryNav title="Create account" />
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
                  <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Sign up</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                    Create your Cafa AI account to save chats, generate media, and sync across devices.
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
                    <AppFormField<SignupFormValues> name="username" label="Username" placeholder="cafa_user" required />
                    <AppFormField<SignupFormValues> name="email" label="Email" placeholder="you@example.com" required />
                    <AppFormField<SignupFormValues>
                      name="password"
                      label="Password"
                      placeholder="Create password"
                      type="password"
                      required
                    />
                    <AppFormField<SignupFormValues>
                      name="confirmPassword"
                      label="Confirm Password"
                      placeholder="Re-enter password"
                      type="password"
                      required
                    />
                    <SubmitButton title="Create account" />
                  </AppForm>
                  <AppButton
                    label="Back to login"
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
