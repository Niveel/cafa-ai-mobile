import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import * as Yup from 'yup';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppForm, AppFormField, SubmitButton } from '@/components/form';
import { API_BASE_URL } from '@/lib';
import { createBillingPortalSession, getSubscriptionStatus } from '@/features/billing/services/subscriptions';
import { deleteCurrentUserAccount, updateCurrentUserProfile, uploadCurrentUserAvatar } from '@/features/auth/services/auth';
import type { AuthUser } from '@/types';
import type { SubscriptionLifecycle, SubscriptionStatus } from '@/types/billing.types';
import { AppPromptModal } from '../AppPromptModal';

type AccountSectionProps = {
  isDark: boolean;
  colors: {
    primary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };
  t: (key: string, params?: Record<string, string>) => string;
  authUser: AuthUser | null;
  refreshAuthUser: () => Promise<void>;
  signOut: () => void;
};

type DeleteAccountFormValues = {
  password: string;
};

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getInitials(name?: string, email?: string) {
  const base = (name?.trim() || email?.split('@')[0] || 'C').trim();
  if (!base) return 'C';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function tierLabel(tier?: AuthUser['subscriptionTier']) {
  switch (tier) {
    case 'cafa_max':
      return 'Cafa Max';
    case 'cafa_pro':
      return 'Cafa Pro';
    case 'cafa_smart':
      return 'Cafa Smart';
    default:
      return 'Free';
  }
}

function resolveAvatarUri(input?: string | null) {
  if (!input) return undefined;
  const value = input.trim();
  if (!value) return undefined;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;

  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  if (value.startsWith('/')) return `${apiOrigin}${value}`;
  return `${apiOrigin}/${value}`;
}

export function AccountSection({
  isDark,
  colors,
  t,
  authUser,
  refreshAuthUser,
  signOut,
}: AccountSectionProps) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLifecycle, setSubscriptionLifecycle] = useState<SubscriptionLifecycle | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null | undefined>(undefined);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [avatarRenderError, setAvatarRenderError] = useState(false);
  const appScheme = ((Constants.expoConfig as { scheme?: string } | undefined)?.scheme || 'cafa-ai').replace('://', '');

  const displayName = useMemo(() => toTitleCase(authUser?.name ?? ''), [authUser?.name]);
  const resolvedAvatarUri = useMemo(() => {
    if (localAvatarUri === null) return undefined;
    if (typeof localAvatarUri === 'string') {
      const resolvedLocal = resolveAvatarUri(localAvatarUri);
      if (resolvedLocal) return resolvedLocal;
    }
    return resolveAvatarUri(authUser?.avatar);
  }, [authUser?.avatar, localAvatarUri]);
  const profileInitial = useMemo(() => getInitials(displayName, authUser?.email), [authUser?.email, displayName]);

  const deleteSchema = useMemo(
    () => Yup.object().shape({ password: Yup.string().required(t('settings.account.deletePasswordRequired')) }),
    [t],
  );

  const ensureSubscription = async () => {
    setLoadingSubscription(true);
    try {
      const data = await getSubscriptionStatus();
      setSubscription(data.subscription);
      setSubscriptionLifecycle(data.subscriptionLifecycle ?? null);
    } catch {
      // Keep section resilient.
    } finally {
      setLoadingSubscription(false);
    }
  };

  useEffect(() => {
    void ensureSubscription();
  }, []);

  useEffect(() => {
    void refreshAuthUser();
  }, [refreshAuthUser]);

  const onPickAvatar = async () => {
    setStatusText('');
    setAvatarBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatusText(t('settings.account.avatarPermission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;
      const pickedAsset = result.assets[0];
      const pickedUri = pickedAsset.uri;
      setLocalAvatarUri(pickedUri);
      setAvatarRenderError(false);

      const uploadedAvatar = await uploadCurrentUserAvatar({
        uri: pickedUri,
        name: pickedAsset.fileName ?? `avatar-${Date.now()}.jpg`,
        type: pickedAsset.mimeType ?? 'image/jpeg',
      });

      if (uploadedAvatar) {
        setLocalAvatarUri(uploadedAvatar);
        try {
          await updateCurrentUserProfile({ avatar: uploadedAvatar });
        } catch {
          // Keep flow resilient if backend already persisted avatar via upload route.
        }
      }
      await refreshAuthUser();

      setStatusText(t('settings.account.avatarUpdated'));
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('settings.account.avatarUpdateError'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    setStatusText('');
    setAvatarBusy(true);
    setLocalAvatarUri(null);
    setAvatarRenderError(false);
    try {
      await updateCurrentUserProfile({ avatar: null });
      await refreshAuthUser();
      setStatusText(t('settings.account.avatarRemoved'));
    } catch (error) {
      setLocalAvatarUri(undefined);
      setStatusText(error instanceof Error ? error.message : t('settings.account.avatarRemoveError'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const onCancelSubscription = async () => {
    setStatusText('');
    try {
      const returnUrl = `${appScheme}://billing/return`;
      const { url } = await createBillingPortalSession({
        platform: 'mobile',
        returnUrl,
      });
      await Linking.openURL(url);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('settings.account.portalError'));
    }
  };

  const submitDelete = async (values: DeleteAccountFormValues) => {
    try {
      await deleteCurrentUserAccount(values.password.trim());
      setShowDeleteForm(false);
      setShowDeletePrompt(false);
      signOut();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('settings.account.deleteError'));
    }
  };

  return (
    <View className="gap-4">
      <View className="rounded-2xl border p-3" style={{ borderColor: colors.border }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('settings.account.profileTitle')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('settings.account.profileAvatar')}</Text>

        <View className="mt-3 items-center">
          <View
            className="items-center justify-center overflow-hidden rounded-full"
            style={{
              width: 124,
              height: 124,
              borderRadius: 999,
              borderWidth: 3.5,
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}20`,
            }}
          >
            {resolvedAvatarUri && !avatarRenderError ? (
              <Image
                key={resolvedAvatarUri}
                source={{ uri: resolvedAvatarUri }}
                style={{ width: 124, height: 124 }}
                accessibilityLabel={t('drawer.userAvatar')}
                onError={() => {
                  setAvatarRenderError(true);
                }}
              />
            ) : (
              <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: '800', lineHeight: 34 }}>
                {profileInitial}
              </Text>
            )}
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 10 }}>{displayName || 'User'}</Text>
        </View>

        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('settings.account.changeAvatar')}
            onPress={() => {
              void onPickAvatar();
            }}
            disabled={avatarBusy}
            className="h-9 items-center justify-center rounded-full px-3"
            style={{ borderWidth: 1.2, borderColor: colors.primary, opacity: avatarBusy ? 0.7 : 1 }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{t('settings.account.changeAvatar')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('settings.account.removeAvatar')}
            onPress={() => {
              void onRemoveAvatar();
            }}
            disabled={avatarBusy}
            className="h-9 items-center justify-center rounded-full px-3"
            style={{
              borderWidth: 1.2,
              borderColor: '#E11D48',
              backgroundColor: isDark ? 'rgba(127, 29, 29, 0.22)' : 'rgba(254, 226, 226, 0.95)',
              opacity: avatarBusy ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#E11D48', fontSize: 12, fontWeight: '600' }}>{t('settings.account.removeAvatar')}</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 gap-1">
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t('settings.account.name')}: {displayName || '-'}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t('settings.account.email')}: {authUser?.email || '-'}</Text>
        </View>
      </View>

      <View className="rounded-2xl border p-3" style={{ borderColor: colors.border }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('settings.account.subscriptionTitle')}</Text>
        <View className="mt-2 gap-1">
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t('settings.account.currentPlan')}: {tierLabel(subscription?.tier ?? authUser?.subscriptionTier)}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t('settings.account.status')}: {subscription?.status ?? 'inactive'}</Text>
          {subscriptionLifecycle?.willCancelAtPeriodEnd && subscriptionLifecycle.scheduledCancelAt ? (
            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 2 }}>
              {t('settings.account.cancelsOn', { date: new Date(subscriptionLifecycle.scheduledCancelAt).toLocaleDateString() })}
            </Text>
          ) : null}
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
            {t('settings.account.renewsOn')}: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}
          </Text>
        </View>

        <View className="mt-3 gap-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('drawer.userMenu.upgrade')}
            onPress={() => router.push('/plans')}
            className="h-10 items-center justify-center rounded-full px-3"
            style={{ backgroundColor: colors.primary }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t('drawer.userMenu.upgrade')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('settings.account.cancelSubscription')}
            onPress={() => {
              void onCancelSubscription();
            }}
            className="h-10 items-center justify-center rounded-full px-3"
            style={{ borderWidth: 1.2, borderColor: colors.primary }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{t('settings.account.cancelSubscription')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 6, lineHeight: 13 }}>
          {t('settings.account.cancelSubscriptionHint')}
        </Text>
      </View>

      <View className="rounded-2xl border p-3" style={{ borderColor: '#E11D48', backgroundColor: isDark ? 'rgba(127,29,29,0.18)' : 'rgba(254,226,226,0.95)' }}>
        <Text style={{ color: '#E11D48', fontSize: 15, fontWeight: '700' }}>{t('settings.account.deleteTitle')}</Text>
        <Text style={{ color: '#E11D48', fontSize: 12, marginTop: 4 }}>{t('settings.account.deleteHint')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('settings.account.deleteAction')}
          onPress={() => setShowDeletePrompt(true)}
          className="mt-3 h-10 items-center justify-center rounded-full px-3"
          style={{ backgroundColor: '#E11D48' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t('settings.account.deleteAction')}</Text>
        </TouchableOpacity>
      </View>

      {statusText ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12 }}>
          {statusText}
        </Text>
      ) : null}

      <AppPromptModal
        visible={showDeletePrompt}
        title={t('settings.account.deleteTitle')}
        message={t('settings.account.deleteConfirmMessage')}
        confirmLabel={t('common.continue')}
        cancelLabel={t('drawer.cancel')}
        confirmTone="danger"
        iconName="warning-outline"
        onCancel={() => setShowDeletePrompt(false)}
        onConfirm={() => {
          setShowDeletePrompt(false);
          setShowDeleteForm(true);
        }}
      />

      <Modal visible={showDeleteForm} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowDeleteForm(false)}>
        <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 10}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View className="flex-1 justify-center px-5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.close')}
                onPress={() => setShowDeleteForm(false)}
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,6,12,0.6)' }}
              />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                showsVerticalScrollIndicator={false}
              >
                <View className="rounded-3xl p-4" style={{ borderWidth: 1.4, borderColor: '#E11D48', backgroundColor: isDark ? '#0E0E12' : '#FFFFFF' }}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('settings.account.deleteAction')}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.close')}
                      onPress={() => setShowDeleteForm(false)}
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{ borderWidth: 1, borderColor: colors.border }}
                    >
                      <Ionicons name="close" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>{t('settings.account.deletePasswordPrompt')}</Text>

                  <AppForm<DeleteAccountFormValues>
                    initialValues={{ password: '' }}
                    validationSchema={deleteSchema}
                    onSubmit={submitDelete}
                  >
                    <AppFormField<DeleteAccountFormValues>
                      name="password"
                      label={t('settings.account.currentPassword')}
                      placeholder={t('settings.account.currentPassword')}
                      type="password"
                      required
                    />
                    <View className="mt-1 flex-row justify-end gap-2">
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('drawer.cancel')}
                        onPress={() => setShowDeleteForm(false)}
                        className="h-10 items-center justify-center rounded-full px-4"
                        style={{ borderWidth: 1.2, borderColor: colors.primary }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('drawer.cancel')}</Text>
                      </TouchableOpacity>
                      <SubmitButton title={t('settings.account.deleteAction')} forceEnable />
                    </View>
                  </AppForm>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {loadingSubscription ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('drawer.loadingChats')}</Text>
      ) : null}
    </View>
  );
}
