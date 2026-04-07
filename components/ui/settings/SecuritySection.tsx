import { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Yup from 'yup';

import { changePassword } from '@/features';
import { AppForm, AppFormField, SubmitButton } from '@/components/form';
import { AppPromptModal } from '../AppPromptModal';

type SecuritySectionProps = {
  isDark: boolean;
  colors: {
    primary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };
  t: (key: string, params?: Record<string, string>) => string;
  signOut: () => void;
};

type PasswordState = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

const EMPTY_PASSWORD_STATE: PasswordState = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

export function SecuritySection({ isDark, colors, t, signOut }: SecuritySectionProps) {
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [statusText, setStatusText] = useState('');
  const [form, setForm] = useState<PasswordState>(EMPTY_PASSWORD_STATE);

  const passwordSchema = useMemo(
    () =>
      Yup.object().shape({
        currentPassword: Yup.string().required(t('settings.security.password.fillAll')),
        newPassword: Yup.string()
          .min(8, t('settings.security.password.minLength'))
          .required(t('settings.security.password.fillAll')),
        confirmNewPassword: Yup.string()
          .oneOf([Yup.ref('newPassword')], t('settings.security.password.mismatch'))
          .required(t('settings.security.password.fillAll')),
      }),
    [t],
  );

  const closePasswordModal = () => {
    setShowChangePasswordModal(false);
    setPasswordError('');
    setForm(EMPTY_PASSWORD_STATE);
    Keyboard.dismiss();
  };

  const submitPasswordChange = async (values: PasswordState) => {
    setSavingPassword(true);
    setPasswordError('');

    try {
      await changePassword(values.currentPassword.trim(), values.newPassword.trim());
      closePasswordModal();
      setStatusText(t('settings.security.password.success'));
      signOut();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('settings.security.password.error'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View className="gap-3">
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('settings.security.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.security.subtitle')}</Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('settings.security.changePassword')}
        onPress={() => {
          setStatusText('');
          setShowChangePasswordModal(true);
        }}
        className="h-11 items-center justify-center rounded-full px-3"
        style={{ borderWidth: 1.2, borderColor: colors.primary }}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('settings.security.changePassword')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('settings.security.logoutDevice')}
        onPress={() => setShowLogoutPrompt(true)}
        className="h-11 items-center justify-center rounded-full px-3"
        style={{ borderWidth: 1.2, borderColor: colors.primary }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{t('settings.security.logoutDevice')}</Text>
      </TouchableOpacity>

      {statusText ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12 }}>
          {statusText}
        </Text>
      ) : null}

      <AppPromptModal
        visible={showLogoutPrompt}
        title={t('settings.security.logoutDeviceTitle')}
        message={t('settings.security.logoutDeviceMessage')}
        confirmLabel={t('settings.security.logoutDevice')}
        cancelLabel={t('drawer.cancel')}
        iconName="log-out-outline"
        onCancel={() => setShowLogoutPrompt(false)}
        onConfirm={() => {
          setShowLogoutPrompt(false);
          signOut();
        }}
      />

      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePasswordModal}
      >
        <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 14 : 12}>
          <View className="flex-1 justify-center px-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.close')}
              onPress={closePasswordModal}
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,6,12,0.6)' }}
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 12 }}
            >
              <View
                className="rounded-3xl p-4"
                style={{ borderWidth: 1.4, borderColor: colors.primary, backgroundColor: isDark ? '#0E0E12' : '#FFFFFF' }}
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                    {t('settings.security.changePassword')}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.close')}
                    onPress={closePasswordModal}
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Ionicons name="close" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                  {t('settings.security.passwordHint')}
                </Text>

                <AppForm<PasswordState>
                  initialValues={form}
                  validationSchema={passwordSchema}
                  enableReinitialize
                  formStyles={{ rowGap: 16 }}
                  onSubmit={async (values) => {
                    setForm(values);
                    await submitPasswordChange(values);
                  }}
                >
                  <AppFormField<PasswordState>
                    name="currentPassword"
                    label={t('settings.security.currentPassword')}
                    placeholder={t('settings.security.currentPassword')}
                    type="password"
                    required
                  />
                  <AppFormField<PasswordState>
                    name="newPassword"
                    label={t('settings.security.newPassword')}
                    placeholder={t('settings.security.newPassword')}
                    type="password"
                    required
                  />
                  <AppFormField<PasswordState>
                    name="confirmNewPassword"
                    label={t('settings.security.confirmNewPassword')}
                    placeholder={t('settings.security.confirmNewPassword')}
                    type="password"
                    required
                  />

                  {passwordError ? (
                    <Text style={{ color: '#E11D48', fontSize: 12 }} accessibilityLiveRegion="polite">
                      {passwordError}
                    </Text>
                  ) : null}

                  <View className="mt-1 flex-row justify-end gap-2">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('drawer.cancel')}
                      onPress={closePasswordModal}
                      className="h-10 items-center justify-center rounded-full px-4"
                      style={{ borderWidth: 1.2, borderColor: colors.primary }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('drawer.cancel')}</Text>
                    </TouchableOpacity>
                    <SubmitButton title={savingPassword ? t('settings.security.savingPassword') : t('settings.security.savePassword')} forceEnable />
                  </View>
                </AppForm>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
