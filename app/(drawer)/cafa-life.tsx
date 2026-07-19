import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppPromptModal, AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme, useI18n, useReducedMotionPreference } from '@/hooks';
import {
  getCafaLifeHistory,
  getCafaLifeVoices,
  previewCafaLifeVoice,
  useCafaLifeSession,
} from '@/features';
import { hapticSelection } from '@/utils';
import type { CafaLifeHistoryTurn, CafaLifeSessionState, CafaLifeVoiceOption } from '@/types';

type AudioPlayer = {
  addListener: (eventName: string, listener: (status: { didJustFinish?: boolean }) => void) => { remove: () => void };
  play: () => void;
  pause: () => void;
  remove: () => void;
};

type ExpoAudioModule = {
  createAudioPlayer: (uri: string, options?: { keepAudioSessionActive?: boolean }) => AudioPlayer;
};

let expoAudioModulePromise: Promise<ExpoAudioModule> | null = null;

async function getExpoAudioModule() {
  if (!expoAudioModulePromise) {
    expoAudioModulePromise = import('expo-audio') as Promise<ExpoAudioModule>;
  }

  try {
    return await expoAudioModulePromise;
  } catch {
    expoAudioModulePromise = null;
    throw new Error('Voice preview is unavailable in this build. Please update the app and try again.');
  }
}

type StatusPresentation = {
  title: string;
  body: string;
  orbColors: [string, string];
  ringColor: string;
  chipBg: string;
  chipText: string;
};

const CAFA_LIVE_KEEP_AWAKE_TAG = 'cafa-live-screen';

function announceForAccessibilitySafe(message: string) {
  try {
    const result = AccessibilityInfo.announceForAccessibility(message) as unknown;
    if (typeof result === 'object' && result !== null && 'then' in result && typeof result.then === 'function') {
      void (result as PromiseLike<void>).then(() => undefined, () => undefined);
    }
  } catch {
    // Ignore accessibility announcement failures.
  }
}

function formatVoiceGender(gender?: string) {
  if (!gender) return 'Voice';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function getStatusPresentation(state: CafaLifeSessionState, t: (key: string) => string): StatusPresentation {
  switch (state) {
    case 'requesting_permission':
      return {
        title: t('cafaLive.status.permission.title'),
        body: t('cafaLive.status.permission.body'),
        orbColors: ['#3C4BFF', '#2536A8'],
        ringColor: '#93C5FD',
        chipBg: '#DBEAFE',
        chipText: '#1D4ED8',
      };
    case 'connecting':
      return {
        title: t('cafaLive.status.connecting.title'),
        body: t('cafaLive.status.connecting.body'),
        orbColors: ['#5B55FF', '#243C96'],
        ringColor: '#A78BFA',
        chipBg: '#EDE9FE',
        chipText: '#6D28D9',
      };
    case 'listening':
      return {
        title: t('cafaLive.status.listening.title'),
        body: t('cafaLive.status.listening.body'),
        orbColors: ['#6F6BFF', '#2E4D9A'],
        ringColor: '#C4B5FD',
        chipBg: '#EEF2FF',
        chipText: '#4338CA',
      };
    case 'speaking':
      return {
        title: t('cafaLive.status.speaking.title'),
        body: t('cafaLive.status.speaking.body'),
        orbColors: ['#10B981', '#0F766E'],
        ringColor: '#6EE7B7',
        chipBg: '#D1FAE5',
        chipText: '#047857',
      };
    case 'muted':
      return {
        title: t('cafaLive.status.muted.title'),
        body: t('cafaLive.status.muted.body'),
        orbColors: ['#F59E0B', '#B45309'],
        ringColor: '#FCD34D',
        chipBg: '#FEF3C7',
        chipText: '#B45309',
      };
    case 'disconnecting':
      return {
        title: t('cafaLive.status.disconnecting.title'),
        body: t('cafaLive.status.disconnecting.body'),
        orbColors: ['#64748B', '#334155'],
        ringColor: '#CBD5E1',
        chipBg: '#E2E8F0',
        chipText: '#334155',
      };
    case 'error':
      return {
        title: t('cafaLive.status.error.title'),
        body: t('cafaLive.status.error.body'),
        orbColors: ['#EF4444', '#991B1B'],
        ringColor: '#FCA5A5',
        chipBg: '#FEE2E2',
        chipText: '#B91C1C',
      };
    case 'idle':
    default:
      return {
        title: t('cafaLive.status.idle.title'),
        body: t('cafaLive.status.idle.body'),
        orbColors: ['#314B90', '#1A2750'],
        ringColor: '#5F7FB8',
        chipBg: '#DBEAFE',
        chipText: '#1E3A8A',
      };
  }
}

function formatRelativeTimestamp(timestamp: string) {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return '';
  const diffMs = Date.now() - time;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatElapsed(startedAt: number | null, now: number) {
  if (!startedAt) return '00:00';
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function VoiceSelectionModal({
  visible,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  onPreviewVoice,
  previewVoiceId,
  isPreviewLoading,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  voices: CafaLifeVoiceOption[];
  selectedVoiceId: string | null;
  onSelectVoice: (voiceId: string) => void;
  onPreviewVoice: (voiceId: string) => void;
  previewVoiceId: string | null;
  isPreviewLoading: boolean;
  colors: { border: string; primary: string; textPrimary: string; textSecondary: string };
  isDark: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(5, 8, 14, 0.78)' : 'rgba(15, 23, 42, 0.32)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cafaLive.voice.close')}
          accessibilityHint={t('cafaLive.voice.closeHint')}
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '84%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1.2,
            borderColor: colors.border,
            backgroundColor: isDark ? '#0E1118' : '#FFFFFF',
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                {t('cafaLive.voice.choose')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {t('cafaLive.voice.chooseBody')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cafaLive.voice.close')}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: isDark ? '#11151D' : '#F8FAFC',
              }}
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            accessible
            accessibilityLabel={t('cafaLive.voice.available')}
            accessibilityHint={t('cafaLive.voice.availableHint')}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ gap: 12 }}>
              {voices.map((voice) => {
                const selected = selectedVoiceId === voice.id;
                const isPreviewingThisVoice = previewVoiceId === voice.id;

                return (
                  <Pressable
                    key={voice.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${voice.name}, ${formatVoiceGender(voice.gender)} voice${voice.default ? ', default' : ''}`}
                    accessibilityHint={t('cafaLive.voice.selectHint')}
                    accessibilityState={{ selected }}
                    onPress={() => onSelectVoice(voice.id)}
                    style={{
                      borderWidth: 1.2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}12` : (isDark ? '#11131A' : '#F8FAFC'),
                      borderRadius: 22,
                      padding: 16,
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View className="flex-row items-center">
                          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
                            {voice.name}
                          </Text>
                          {voice.default ? (
                            <View
                              className="ml-2 rounded-full px-2 py-1"
                              style={{ backgroundColor: selected ? `${colors.primary}20` : (isDark ? '#1B2230' : '#E2E8F0') }}
                            >
                              <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                {t('cafaLive.voice.default')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                          {formatVoiceGender(voice.gender)}
                        </Text>
                        {voice.description ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                            {voice.description}
                          </Text>
                        ) : null}
                      </View>

                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 30,
                          height: 30,
                          borderWidth: 1.2,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary : 'transparent',
                        }}
                      >
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        ) : null}
                      </View>
                    </View>

                    <View className="mt-4 flex-row items-center justify-between">
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Preview ${voice.name}'s voice`}
                        accessibilityHint={t('cafaLive.voice.previewHint')}
                        onPress={() => onPreviewVoice(voice.id)}
                        className="rounded-full px-4 py-3"
                        style={{
                          borderWidth: 1.2,
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#151924' : '#FFFFFF',
                        }}
                      >
                        <View className="flex-row items-center">
                          {isPreviewLoading && isPreviewingThisVoice ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
                          )}
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                            {isPreviewingThisVoice && isPreviewLoading ? t('cafaLive.voice.loadingPreview') : t('cafaLive.voice.preview')}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {selected ? (
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                          {t('cafaLive.voice.selected')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CafaLiveSettingsModal({
  visible,
  onClose,
  onOpenVoicePicker,
  onRefreshVoices,
  isRefreshingVoices,
  isVoicesLoading,
  voiceError,
  selectedVoice,
  onPreviewVoice,
  previewVoiceId,
  previewState,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenVoicePicker: () => void;
  onRefreshVoices: () => void;
  isRefreshingVoices: boolean;
  isVoicesLoading: boolean;
  voiceError: string | null;
  selectedVoice: CafaLifeVoiceOption | null;
  onPreviewVoice: (voiceId: string) => void;
  previewVoiceId: string | null;
  previewState: 'idle' | 'loading' | 'playing';
  colors: { border: string; primary: string; textPrimary: string; textSecondary: string };
  isDark: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 8, 14, 0.78)' : 'rgba(15, 23, 42, 0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('cafaLive.settings.close')} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '82%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1.2,
            borderColor: colors.border,
            backgroundColor: isDark ? '#0E1118' : '#FFFFFF',
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                {t('cafaLive.settings.title')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {t('cafaLive.settings.subtitle')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cafaLive.settings.close')}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View
            className="overflow-hidden rounded-[28px] border"
            style={{ borderColor: `${colors.primary}35`, backgroundColor: isDark ? '#0A1220' : '#F8FBFF' }}
          >
            <LinearGradient
              colors={isDark ? ['#101A2B', '#0B1220', '#111827'] : ['#F5F9FF', '#EEF4FF', '#F9FBFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 14 }}
            >
              <View className="flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                    {t('cafaLive.settings.voiceSetup')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                    {t('cafaLive.settings.voiceSetupBody')}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('cafaLive.settings.refreshVoices')}
                  accessibilityHint={t('cafaLive.settings.refreshVoicesHint')}
                  onPress={onRefreshVoices}
                  className="rounded-full px-3 py-2"
                  style={{
                    borderWidth: 1.2,
                    borderColor: `${colors.primary}35`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                  }}
                >
                  {isRefreshingVoices ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {isVoicesLoading ? (
                <View className="mt-3 flex-row items-center rounded-[18px] border px-3 py-3" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 10 }}>
                    {t('cafaLive.settings.loadingVoices')}
                  </Text>
                </View>
              ) : voiceError ? (
                <View
                  className="mt-3 rounded-[18px] border px-3 py-3"
                  accessible
                  accessibilityLiveRegion="polite"
                  style={{ borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }}
                >
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700' }}>
                    {voiceError}
                  </Text>
                </View>
              ) : selectedVoice ? (
                <View className="mt-3 rounded-[20px] border px-3 py-3" style={{ borderColor: `${colors.primary}45`, backgroundColor: isDark ? 'rgba(15,23,42,0.78)' : '#FFFFFF' }}>
                  <View className="flex-row items-start justify-between">
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
                        {selectedVoice.name}
                      </Text>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                        {t('cafaLive.settings.voiceType', { gender: formatVoiceGender(selectedVoice.gender) })}
                      </Text>
                      {selectedVoice.description ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                          {selectedVoice.description}
                        </Text>
                      ) : null}
                    </View>

                    <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: `${colors.primary}16` }}>
                      <Ionicons name="radio-outline" size={16} color={colors.primary} />
                    </View>
                  </View>

                  <View className="mt-3 flex-row flex-wrap">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('cafaLive.settings.openVoicePicker')}
                      accessibilityHint={t('cafaLive.settings.openVoicePickerHint')}
                      onPress={onOpenVoicePicker}
                      className="mr-3 rounded-full px-4 py-2.5"
                      style={{ borderWidth: 1.2, borderColor: colors.primary, backgroundColor: colors.primary }}
                    >
                      <View className="flex-row items-center">
                        <Ionicons name="swap-horizontal-outline" size={15} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                          {t('cafaLive.settings.changeVoice')}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Preview ${selectedVoice.name}'s voice`}
                      accessibilityHint={t('cafaLive.settings.selectedPreviewHint')}
                      onPress={() => onPreviewVoice(selectedVoice.id)}
                      className="rounded-full px-4 py-2.5"
                      style={{ borderWidth: 1.2, borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#FFFFFF' }}
                    >
                      <View className="flex-row items-center">
                        {previewVoiceId === selectedVoice.id && previewState === 'loading' ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons
                            name={previewVoiceId === selectedVoice.id && previewState === 'playing' ? 'stop-circle-outline' : 'volume-high-outline'}
                            size={15}
                            color={colors.primary}
                          />
                        )}
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                          {previewVoiceId === selectedVoice.id && previewState === 'playing'
                            ? t('cafaLive.settings.stopPreview')
                            : previewVoiceId === selectedVoice.id && previewState === 'loading'
                              ? t('cafaLive.voice.loadingPreview')
                              : t('cafaLive.settings.previewVoice')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('cafaLive.settings.openVoicePicker')}
                  accessibilityHint={t('cafaLive.settings.chooseVoiceHint')}
                  onPress={onOpenVoicePicker}
                  className="mt-3 rounded-[20px] border px-3 py-3"
                  style={{ borderColor: `${colors.primary}35`, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }}
                >
                  <View className="flex-row items-center">
                    <View className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: `${colors.primary}14` }}>
                      <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                        {t('cafaLive.settings.voiceSetup')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                        {t('cafaLive.settings.openVoiceList')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CafaLiveHistoryModal({
  visible,
  onClose,
  history,
  isHistoryLoading,
  isRefreshingHistory,
  historyError,
  onRefreshHistory,
  assistantLabel,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  history: CafaLifeHistoryTurn[];
  isHistoryLoading: boolean;
  isRefreshingHistory: boolean;
  historyError: string | null;
  onRefreshHistory: () => void;
  assistantLabel: string;
  colors: { border: string; primary: string; textPrimary: string; textSecondary: string };
  isDark: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 8, 14, 0.78)' : 'rgba(15, 23, 42, 0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('cafaLive.history.close')} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '84%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1.2,
            borderColor: colors.border,
            backgroundColor: isDark ? '#0E1118' : '#FFFFFF',
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                {t('cafaLive.history.title')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {t('cafaLive.history.subtitle')}
              </Text>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('cafaLive.history.refresh')}
                accessibilityHint={t('cafaLive.history.refreshHint')}
                onPress={onRefreshHistory}
                className="mr-2 rounded-full px-3 py-2"
                style={{ borderWidth: 1.2, borderColor: colors.primary, backgroundColor: `${colors.primary}10` }}
              >
                {isRefreshingHistory ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cafaLive.history.close')}
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {isHistoryLoading ? (
              <View className="items-center justify-center" style={{ paddingVertical: 28 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
                  {t('cafaLive.history.loading')}
                </Text>
              </View>
            ) : historyError ? (
              <View className="mt-1 rounded-2xl border px-4 py-3" style={{ borderColor: colors.border, backgroundColor: isDark ? '#111827' : '#F8FAFC' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {historyError}
                </Text>
              </View>
            ) : history.length === 0 ? (
              <View className="mt-1 rounded-2xl border px-4 py-5" style={{ borderColor: colors.border, backgroundColor: isDark ? '#10151D' : '#F8FAFC' }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                  {t('cafaLive.history.emptyTitle')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 }}>
                  {t('cafaLive.history.emptyBody')}
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 4, gap: 10, paddingBottom: 8 }}>
                {history.map((turn, index) => {
                  const isAssistant = turn.role === 'assistant';
                  return (
                    <View
                      key={`${turn.timestamp}-${index}`}
                      className="rounded-2xl border px-4 py-3"
                      accessibilityRole="text"
                      accessibilityLabel={`${isAssistant ? 'Assistant' : 'You'} said ${turn.content}`}
                      style={{
                        borderColor: colors.border,
                        backgroundColor: isAssistant ? (isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5') : (isDark ? 'rgba(99,102,241,0.08)' : '#EEF2FF'),
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center" style={{ flex: 1, paddingRight: 10 }}>
                          <View className="items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: isAssistant ? '#10B981' : colors.primary }}>
                            <Ionicons name={isAssistant ? 'chatbubble-ellipses-outline' : 'person-outline'} size={15} color="#FFFFFF" />
                          </View>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                              {isAssistant ? assistantLabel : t('cafaLive.history.you')}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                              {formatRelativeTimestamp(turn.timestamp)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>
                        {turn.content}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CafaLifeScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotionPreference();
  const { width: screenWidth } = useWindowDimensions();
  const {
    state,
    error,
    isMuted,
    assistantName,
    isRuntimeSupported,
    runtimeMessage,
    startedAt,
    isActive,
    startSession,
    endSession,
    toggleMute,
  } = useCafaLifeSession();
  const [history, setHistory] = useState<CafaLifeHistoryTurn[]>([]);
  const [voices, setVoices] = useState<CafaLifeVoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [isVoicePickerVisible, setIsVoicePickerVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isVoicesLoading, setIsVoicesLoading] = useState(true);
  const [isRefreshingVoices, setIsRefreshingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [tooltipState, setTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const pulseValue = useRef(new Animated.Value(0)).current;
  const haloRotate = useRef(new Animated.Value(0)).current;
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const prevActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const previewPlayerRef = useRef<AudioPlayer | null>(null);
  const previewPlayerSubRef = useRef<{ remove: () => void } | null>(null);
  const previewUriByVoiceIdRef = useRef<Record<string, string>>({});
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePickerOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentation = getStatusPresentation(state, t);

  const stopPreview = useCallback(() => {
    previewPlayerSubRef.current?.remove();
    previewPlayerSubRef.current = null;
    previewPlayerRef.current?.pause();
    previewPlayerRef.current?.remove();
    previewPlayerRef.current = null;
    setPreviewState('idle');
    setPreviewVoiceId(null);
  }, []);

  const loadHistory = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshingHistory(true);
    else setIsHistoryLoading(true);

    try {
      const payload = await getCafaLifeHistory();
      setHistory(payload.turns ?? []);
      setHistoryError(null);
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : 'Could not load recent voice history.');
    } finally {
      setIsHistoryLoading(false);
      setIsRefreshingHistory(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      previewPlayerSubRef.current?.remove();
      previewPlayerSubRef.current = null;
      previewPlayerRef.current?.pause();
      previewPlayerRef.current?.remove();
      previewPlayerRef.current = null;
      if (voicePickerOpenTimeoutRef.current) {
        clearTimeout(voicePickerOpenTimeoutRef.current);
        voicePickerOpenTimeoutRef.current = null;
      }
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
    };
  }, []);

  const loadVoices = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshingVoices(true);
    else setIsVoicesLoading(true);

    try {
      const payload = await getCafaLifeVoices({ forceRefresh: refresh });
      const nextVoices = payload.voices ?? [];
      const fallbackVoiceId = payload.defaultVoice
        || nextVoices.find((voice) => voice.default)?.id
        || nextVoices[0]?.id
        || null;

      if (!isMountedRef.current) return;
      setVoices(nextVoices);
      setSelectedVoiceId((current) => {
        if (current && nextVoices.some((voice) => voice.id === current)) return current;
        return fallbackVoiceId;
      });
      setVoiceError(null);
    } catch (loadError) {
      if (!isMountedRef.current) return;
      setVoiceError(loadError instanceof Error ? loadError.message : 'Could not load voices right now.');
    } finally {
      if (!isMountedRef.current) return;
      setIsVoicesLoading(false);
      setIsRefreshingVoices(false);
    }
  }, []);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isActive || !startedAt) return;
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isActive && state === 'idle') {
      void loadHistory(true);
    }
    prevActiveRef.current = isActive;
  }, [isActive, loadHistory, state]);

  useEffect(() => {
    pulseValue.stopAnimation();
    haloRotate.stopAnimation();
    shimmerValue.stopAnimation();

    if (prefersReducedMotion) {
      pulseValue.setValue(0.45);
      haloRotate.setValue(0);
      shimmerValue.setValue(0.5);
      return;
    }

    const pulseDuration =
      state === 'speaking' ? 1350
        : state === 'connecting' ? 900
          : state === 'listening' ? 2200
            : state === 'muted' ? 1800
              : 2600;

    pulseValue.setValue(0);
    haloRotate.setValue(0);
    shimmerValue.setValue(0);

    const pulseLoop = Animated.loop(
      Animated.timing(pulseValue, {
        toValue: 1,
        duration: pulseDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );

    const haloLoop = Animated.loop(
      Animated.timing(haloRotate, {
        toValue: 1,
        duration: state === 'speaking' ? 4000 : 6500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    haloLoop.start();
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      haloLoop.stop();
      shimmerLoop.stop();
    };
  }, [haloRotate, prefersReducedMotion, pulseValue, shimmerValue, state]);

  useEffect(() => {
    if (!historyError) return;
    announceForAccessibilitySafe(historyError);
  }, [historyError]);

  useEffect(() => {
    if (!voiceError) return;
    announceForAccessibilitySafe(voiceError);
  }, [voiceError]);

  const elapsedLabel = useMemo(() => formatElapsed(startedAt, now), [now, startedAt]);
  const haloRotation = useMemo(
    () => haloRotate.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    }),
    [haloRotate],
  );
  const shimmerOpacity = useMemo(
    () => shimmerValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.5],
    }),
    [shimmerValue],
  );

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [selectedVoiceId, voices],
  );

  const onPressOrb = useCallback(() => {
    hapticSelection();
    if (isActive) {
      setShowEndPrompt(true);
      return;
    }
    stopPreview();
    void startSession(selectedVoiceId ?? undefined);
  }, [isActive, selectedVoiceId, startSession, stopPreview]);

  const handleRefreshHistory = useCallback(() => {
    hapticSelection();
    void loadHistory(true);
  }, [loadHistory]);

  const handleRefreshVoices = useCallback(() => {
    hapticSelection();
    void loadVoices(true);
  }, [loadVoices]);

  const handleOpenVoicePicker = useCallback(() => {
    hapticSelection();
    stopPreview();
    if (voicePickerOpenTimeoutRef.current) {
      clearTimeout(voicePickerOpenTimeoutRef.current);
      voicePickerOpenTimeoutRef.current = null;
    }
    if (isSettingsVisible) {
      setIsSettingsVisible(false);
      voicePickerOpenTimeoutRef.current = setTimeout(() => {
        voicePickerOpenTimeoutRef.current = null;
        if (!isMountedRef.current) return;
        setIsVoicePickerVisible(true);
      }, 250);
      return;
    }
    setIsVoicePickerVisible(true);
  }, [isSettingsVisible, stopPreview]);

  const showTooltip = useCallback((text: string, event?: GestureResponderEvent) => {
    hapticSelection();
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const fallbackX = screenWidth / 2;
    const fallbackY = 180;
    const pageX = event?.nativeEvent?.pageX ?? fallbackX;
    const pageY = event?.nativeEvent?.pageY ?? fallbackY;

    setTooltipState({ text, x: pageX, y: pageY });
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipState(null);
      tooltipTimeoutRef.current = null;
    }, 1200);
  }, [screenWidth]);

  const handlePreviewVoice = useCallback(async (voiceId: string) => {
    if (previewVoiceId === voiceId && previewState === 'playing') {
      stopPreview();
      announceForAccessibilitySafe('Voice preview stopped.');
      return;
    }

    stopPreview();
    setVoiceError(null);
    setPreviewVoiceId(voiceId);
    setPreviewState('loading');

    try {
      let uri = previewUriByVoiceIdRef.current[voiceId];
      if (!uri) {
        const bytes = await previewCafaLifeVoice(voiceId);
        const file = new File(Paths.cache, `cafa-live-voice-preview-${voiceId}.mp3`);
        file.create({ overwrite: true, intermediates: true });
        file.write(bytes);
        uri = file.uri;
        previewUriByVoiceIdRef.current[voiceId] = uri;
      }

      const { createAudioPlayer } = await getExpoAudioModule();
      const player = createAudioPlayer(uri, { keepAudioSessionActive: true });
      previewPlayerRef.current = player;
      previewPlayerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopPreview();
        }
      });
      player.play();
      setPreviewState('playing');
      announceForAccessibilitySafe('Voice preview playing.');
    } catch (previewError) {
      stopPreview();
      const message = previewError instanceof Error ? previewError.message : 'Voice preview failed.';
      setVoiceError(message);
    }
  }, [previewState, previewVoiceId, stopPreview]);

  useFocusEffect(
    useCallback(() => {
      void activateKeepAwakeAsync(CAFA_LIVE_KEEP_AWAKE_TAG);

      return () => {
        setShowEndPrompt(false);
        setIsVoicePickerVisible(false);
        stopPreview();
        void deactivateKeepAwake(CAFA_LIVE_KEEP_AWAKE_TAG).catch(() => undefined);
        void endSession();
      };
    }, [endSession, stopPreview]),
  );

  const assistantLabel = assistantName || 'Cafa';

  return (
    <RequireAuthRoute>
      <AppPromptModal
        visible={showEndPrompt}
        title={t('cafaLive.end.title')}
        message={t('cafaLive.end.message')}
        confirmLabel={t('cafaLive.end.confirm')}
        cancelLabel={t('drawer.cancel')}
        confirmTone="danger"
        iconName="call-outline"
        onCancel={() => setShowEndPrompt(false)}
        onConfirm={() => {
          setShowEndPrompt(false);
          void endSession();
        }}
      />

      <VoiceSelectionModal
        visible={isVoicePickerVisible}
        onClose={() => {
          stopPreview();
          setIsVoicePickerVisible(false);
        }}
        voices={voices}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={(voiceId) => {
          stopPreview();
          setSelectedVoiceId(voiceId);
          setIsVoicePickerVisible(false);
          setIsSettingsVisible(true);
          announceForAccessibilitySafe(`${voices.find((voice) => voice.id === voiceId)?.name ?? 'Voice'} selected.`);
        }}
        onPreviewVoice={handlePreviewVoice}
        previewVoiceId={previewVoiceId}
        isPreviewLoading={previewState === 'loading'}
        colors={colors}
        isDark={isDark}
      />
      <CafaLiveSettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onOpenVoicePicker={handleOpenVoicePicker}
        onRefreshVoices={handleRefreshVoices}
        isRefreshingVoices={isRefreshingVoices}
        isVoicesLoading={isVoicesLoading}
        voiceError={voiceError}
        selectedVoice={selectedVoice}
        onPreviewVoice={handlePreviewVoice}
        previewVoiceId={previewVoiceId}
        previewState={previewState}
        colors={colors}
        isDark={isDark}
      />
      <CafaLiveHistoryModal
        visible={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        history={history}
        isHistoryLoading={isHistoryLoading}
        isRefreshingHistory={isRefreshingHistory}
        historyError={historyError}
        onRefreshHistory={handleRefreshHistory}
        assistantLabel={assistantLabel}
        colors={colors}
        isDark={isDark}
      />

      <AppScreen
        title={t('drawer.cafaLife')}
        subtitle={t('screen.cafaLifeSubtitle')}
      >
        <View className="flex-1">
          <View
            className="flex-1 overflow-hidden rounded-[30px] border"
            style={{
              borderColor: `${presentation.ringColor}55`,
              backgroundColor: isDark ? '#07111F' : '#F8FBFF',
            }}
          >
            <LinearGradient
              colors={isDark ? ['#0A1324', '#101B30', '#0B1220'] : ['#F8FBFF', '#EEF5FF', '#F7FAFC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, padding: 18 }}
            >
              <View className="flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <View
                    className="self-start rounded-full px-3 py-1.5"
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`Session state: ${presentation.title}`}
                    style={{ backgroundColor: presentation.chipBg }}
                  >
                    <Text style={{ color: presentation.chipText, fontSize: 12, fontWeight: '700' }}>
                      {presentation.title}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('cafaLive.history.refresh')}
                    accessibilityHint={t('cafaLive.history.loadHint')}
                    onLongPress={(event) => showTooltip(t('cafaLive.history.refreshShort'), event)}
                    onPress={handleRefreshHistory}
                    className="rounded-full px-3 py-2"
                    style={{ borderWidth: 1.2, borderColor: colors.primary, backgroundColor: colors.primary }}
                  >
                    {isRefreshingHistory ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('cafaLive.settings.open')}
                    accessibilityHint={t('cafaLive.settings.openHint')}
                    onLongPress={(event) => showTooltip(t('cafaLive.settings.title'), event)}
                    onPress={() => setIsSettingsVisible(true)}
                    className="ml-2 rounded-full px-3 py-2"
                    style={{ borderWidth: 1.2, borderColor: colors.primary, backgroundColor: colors.primary }}
                  >
                    <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('cafaLive.history.open')}
                    accessibilityHint={t('cafaLive.history.openHint')}
                    onLongPress={(event) => showTooltip(t('cafaLive.history.shortTitle'), event)}
                    onPress={() => setIsHistoryVisible(true)}
                    className="ml-2 rounded-full px-3 py-2"
                    style={{ borderWidth: 1.2, borderColor: colors.primary, backgroundColor: colors.primary }}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-1 items-center justify-center" style={{ marginTop: 24, marginBottom: 18 }}>
                <View style={{ width: 264, height: 264, alignItems: 'center', justifyContent: 'center' }}>
                  {[0, 0.22, 0.44].map((offset, index) => (
                    <Animated.View
                      key={`ring-${index}`}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        width: 236,
                        height: 236,
                        borderRadius: 118,
                        borderWidth: 1.5,
                        borderColor: `${presentation.ringColor}${index === 0 ? '44' : index === 1 ? '33' : '22'}`,
                        opacity: pulseValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.52 - offset * 0.5, 0],
                        }),
                        transform: [
                          {
                            scale: pulseValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.62 + offset, 1.08 + offset],
                            }),
                          },
                        ],
                      }}
                    />
                  ))}

                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: 226,
                      height: 226,
                      borderRadius: 113,
                      borderWidth: 1,
                      borderColor: `${presentation.ringColor}35`,
                      transform: [{ rotate: haloRotation }],
                    }}
                  />

                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: 178,
                      height: 178,
                      borderRadius: 89,
                      opacity: shimmerOpacity,
                    }}
                  >
                    <LinearGradient
                      colors={['transparent', `${presentation.ringColor}55`, 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ flex: 1, borderRadius: 89 }}
                    />
                  </Animated.View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t(isActive ? 'cafaLive.session.end' : 'cafaLive.session.start')}
                    accessibilityHint={t(isActive ? 'cafaLive.session.endHint' : 'cafaLive.session.startHint')}
                    accessibilityState={{ busy: state === 'connecting' || state === 'requesting_permission' || state === 'disconnecting' }}
                    onPress={onPressOrb}
                    activeOpacity={0.9}
                    style={{
                      width: 164,
                      height: 164,
                      borderRadius: 82,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: presentation.ringColor,
                      shadowOpacity: isDark ? 0.5 : 0.22,
                      shadowRadius: state === 'speaking' ? 28 : 18,
                      shadowOffset: { width: 0, height: 12 },
                      elevation: state === 'speaking' ? 18 : 10,
                    }}
                  >
                    <LinearGradient
                      colors={presentation.orbColors}
                      start={{ x: 0.12, y: 0.1 }}
                      end={{ x: 0.88, y: 0.96 }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 82,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.18)',
                      }}
                    >
                      {state === 'connecting' || state === 'requesting_permission' || state === 'disconnecting' ? (
                        <ActivityIndicator color="#FFFFFF" size="large" />
                      ) : (
                        <>
                          <Ionicons
                            name={
                              state === 'speaking' ? 'volume-high-outline'
                                : state === 'muted' ? 'mic-off-outline'
                                  : isActive ? 'stop-circle-outline' : 'mic-outline'
                            }
                            size={42}
                            color="#FFFFFF"
                          />
                          <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700', marginTop: 10 }}>
                            {t(isActive ? 'cafaLive.session.tapEnd' : 'cafaLive.session.tapStart')}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 10 }}>
                  {elapsedLabel}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                  {t(isActive ? 'cafaLive.session.live' : 'cafaLive.session.ready')}
                </Text>
              </View>

              {isActive ? (
                <View className="mt-2 self-center">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t(isMuted ? 'cafaLive.session.unmute' : 'cafaLive.session.mute')}
                    accessibilityHint={t('cafaLive.session.muteHint')}
                    activeOpacity={0.88}
                    onPress={() => {
                      hapticSelection();
                      void toggleMute();
                    }}
                    className="flex-row items-center rounded-full px-4 py-3"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    }}
                  >
                    <Ionicons
                      name={isMuted ? 'volume-high-outline' : 'mic-off-outline'}
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                      {t(isMuted ? 'cafaLive.session.unmuteShort' : 'cafaLive.session.muteShort')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {error ? (
                <View
                  className="mt-4 rounded-2xl border px-4 py-3"
                  accessible
                  accessibilityLiveRegion="polite"
                  style={{
                    borderColor: '#FCA5A5',
                    backgroundColor: '#FFF1F2',
                  }}
                >
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700' }}>
                    {error.message}
                  </Text>
                </View>
              ) : null}

              {!isRuntimeSupported && runtimeMessage ? (
                <View
                  className="mt-4 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                    {t('cafaLive.runtime.nativeRequired')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 }}>
                    {runtimeMessage}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>

        </View>
        {tooltipState ? (
          <Animated.View
            pointerEvents="none"
            className="absolute rounded-md px-2 py-1"
            style={{
              zIndex: 9999,
              elevation: 120,
              borderWidth: 1,
              borderColor: isDark ? '#3F3F46' : '#27272A',
              backgroundColor: isDark ? '#0B0B0F' : '#111111',
              left: Math.max(8, Math.min(tooltipState.x - 56, screenWidth - 124)),
              top: Math.max(8, tooltipState.y - 40),
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{tooltipState.text}</Text>
          </Animated.View>
        ) : null}
      </AppScreen>
    </RequireAuthRoute>
  );
}
