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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppForm, AppFormField, SecondaryNav, SubmitButton } from '@/components';
import { useAppContext } from '@/context';
import { ContactSupportFormValues, ContactSupportValidationSchema } from '@/data';
import { submitSupportContact } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { apiEndpoints } from '@/services/api';

export default function HelpScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const { authUser } = useAppContext();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<{ tone: 'idle' | 'success' | 'error'; message: string }>({
    tone: 'idle',
    message: '',
  });

  const initialValues: ContactSupportFormValues = {
    name: authUser?.name?.trim() ?? '',
    email: authUser?.email?.trim() ?? '',
    subject: '',
    message: '',
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
      <SecondaryNav title={t('drawer.userMenu.help')} topOffset={Math.max(insets.top, 0)} />
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 10}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            <View
              className="mt-3 rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F12' : '#FFFFFF' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                {t('help.contactTitle')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                {t('help.contactSubtitle')}
              </Text>

              <View className="mt-4">
                <AppForm<ContactSupportFormValues>
                  initialValues={initialValues}
                  validationSchema={ContactSupportValidationSchema}
                  onSubmit={async (values, helpers) => {
                    setStatus({ tone: 'idle', message: '' });
                    try {
                      const result = await submitSupportContact({
                        name: values.name.trim(),
                        email: values.email.trim(),
                        subject: values.subject.trim(),
                        message: values.message.trim(),
                      });
                      setStatus({
                        tone: 'success',
                        message: result.message || t('help.submitSuccess'),
                      });
                      helpers.resetForm({
                        values: {
                          name: values.name.trim(),
                          email: values.email.trim(),
                          subject: '',
                          message: '',
                        },
                      });
                    } catch (error) {
                      const mapped = error as { message?: string; code?: string; status?: number };
                      const message = mapped?.message ?? t('help.submitError');
                      console.log(
                        `[help-contact:error] endpoint=${API_BASE_URL}${apiEndpoints.support.contact} code=${mapped?.code ?? 'unknown'} status=${mapped?.status ?? 'unknown'} message="${message}"`,
                      );
                      setStatus({ tone: 'error', message });
                    }
                  }}
                >
                  <AppFormField<ContactSupportFormValues>
                    name="name"
                    label={t('help.formName')}
                    placeholder={t('help.formNamePlaceholder')}
                    autoComplete="name"
                    required
                  />
                  <AppFormField<ContactSupportFormValues>
                    name="email"
                    type="email"
                    label={t('help.formEmail')}
                    placeholder={t('placeholder.email')}
                    autoComplete="email"
                    inputMode="email"
                    autoCorrect={false}
                    required
                  />
                  <AppFormField<ContactSupportFormValues>
                    name="subject"
                    label={t('help.formSubject')}
                    placeholder={t('help.formSubjectPlaceholder')}
                    maxLength={200}
                    required
                  />
                  <AppFormField<ContactSupportFormValues>
                    name="message"
                    multiline
                    rows={7}
                    label={t('help.formMessage')}
                    placeholder={t('help.formMessagePlaceholder')}
                    maxLength={2000}
                    required
                  />

                  {status.tone !== 'idle' ? (
                    <View
                      className="rounded-xl border px-3 py-2"
                      style={{
                        borderColor:
                          status.tone === 'success'
                            ? isDark
                              ? 'rgba(16, 185, 129, 0.45)'
                              : 'rgba(5, 150, 105, 0.35)'
                            : isDark
                              ? 'rgba(251, 113, 133, 0.5)'
                              : 'rgba(220, 38, 38, 0.35)',
                        backgroundColor:
                          status.tone === 'success'
                            ? isDark
                              ? 'rgba(6, 78, 59, 0.25)'
                              : 'rgba(209, 250, 229, 0.95)'
                            : isDark
                              ? 'rgba(127, 29, 29, 0.28)'
                              : 'rgba(254, 226, 226, 0.95)',
                      }}
                    >
                      <Text
                        style={{
                          color:
                            status.tone === 'success'
                              ? isDark
                                ? '#6EE7B7'
                                : '#065F46'
                              : isDark
                                ? '#FCA5A5'
                                : '#B91C1C',
                          fontSize: 12,
                        }}
                      >
                        {status.message}
                      </Text>
                    </View>
                  ) : null}

                  <SubmitButton title={t('help.submitButton')} forceEnable />
                </AppForm>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

