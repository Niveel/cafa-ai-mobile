import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppButton, AppScreen, RequireAuthRoute, VoiceCloneRecorderModal } from '@/components';
import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import {
  cloneAvatarVoice,
  convertTextToSpeech,
  getDailyUsage,
  getTextToSpeechHistory,
  getTextToSpeechVoiceCatalog,
  getTextToSpeechVoiceClones,
  previewTextToSpeechVoice,
} from '@/features';
import type {
  AvatarClonedVoice,
  AvatarVoiceOption,
  SubscriptionTier,
  TtsConversionResult,
  TtsFormat,
} from '@/types';

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
    throw new Error('Audio playback is unavailable in this build. Please update the app and try again.');
  }
}

type SelectedVoice =
  | { type: 'library'; key: string; label: string; voiceId: string }
  | { type: 'clone'; key: string; label: string; fishAudioId: string };

function formatTierLabel(tier: SubscriptionTier) {
  if (tier === 'cafa_smart') return 'Cafa Smart';
  if (tier === 'cafa_pro') return 'Cafa Pro';
  if (tier === 'cafa_max') return 'Cafa Max';
  return 'Free';
}

function getCharacterLimit(tier: SubscriptionTier) {
  return tier === 'free' ? 500 : 3000;
}

function getMonthlyTtsLimit(tier: SubscriptionTier) {
  if (tier === 'cafa_max') return -1;
  if (tier === 'cafa_pro') return 200;
  if (tier === 'cafa_smart') return 50;
  return 5;
}

function formatVoiceMeta(voice: AvatarVoiceOption) {
  return [voice.gender, voice.category].filter(Boolean).join(' - ') || 'Library voice';
}

function formatRelativeTimestamp(value?: string | null) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(value).toLocaleDateString();
}

function NoticeCard({
  title,
  message,
  tone,
  colors,
  isDark,
}: {
  title?: string;
  message: string;
  tone: 'error' | 'info' | 'success';
  colors: { border: string; primary: string; textPrimary: string };
  isDark: boolean;
}) {
  const palette = tone === 'error'
    ? { borderColor: '#FCA5A5', backgroundColor: isDark ? '#2A1116' : '#FFF1F2', textColor: isDark ? '#FECACA' : '#B91C1C', icon: 'alert-circle-outline' as const }
    : tone === 'success'
      ? { borderColor: '#86EFAC', backgroundColor: isDark ? '#0E2219' : '#ECFDF5', textColor: isDark ? '#BBF7D0' : '#047857', icon: 'checkmark-circle-outline' as const }
      : { borderColor: isDark ? '#4F46E5' : '#C7D2FE', backgroundColor: isDark ? '#151A2D' : '#EEF2FF', textColor: isDark ? '#E0E7FF' : '#312E81', icon: 'information-circle-outline' as const };

  return (
    <View
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
      }}
    >
      <View className="flex-row items-start">
        <Ionicons name={palette.icon} size={18} color={palette.textColor} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          {title ? (
            <Text style={{ color: palette.textColor, fontSize: 13, lineHeight: 18, fontWeight: '800', marginBottom: 4 }}>
              {title}
            </Text>
          ) : null}
          <Text style={{ color: palette.textColor, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProcessingCard({
  title,
  message,
  colors,
  isDark,
}: {
  title: string;
  message: string;
  colors: { border: string; primary: string; textPrimary: string; textSecondary: string };
  isDark: boolean;
}) {
  return (
    <View
      className="mb-4 rounded-[28px] border px-4 py-4"
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`${title}. ${message}`}
      style={{
        borderColor: `${colors.primary}35`,
        backgroundColor: isDark ? '#101827' : '#EEF4FF',
      }}
    >
      <View className="flex-row items-center">
        <View
          className="mr-3 h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.primary}18` }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
            {title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VoiceChip({
  title,
  subtitle,
  selected,
  onPress,
  onPreview,
  previewBusy,
  colors,
  isDark,
  statusLabel,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  onPreview: () => void;
  previewBusy: boolean;
  colors: { border: string; primary: string; textPrimary: string; textSecondary: string };
  isDark: boolean;
  statusLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <View
      className="rounded-[22px] border p-4"
      style={{
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}10` : (isDark ? '#0F141C' : '#FFFFFF'),
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}>
        <View className="flex-row items-start justify-between">
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
              {title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
              {subtitle}
            </Text>
            {statusLabel ? (
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 8 }}>
                {statusLabel}
              </Text>
            ) : null}
          </View>
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 28,
              height: 28,
              borderWidth: 1.2,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : 'transparent',
            }}
          >
            {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
          </View>
        </View>
      </Pressable>

      <View className="mt-4 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={onPreview}
          disabled={disabled || previewBusy}
          className="rounded-full border px-3 py-2"
          style={{
            borderColor: colors.border,
            backgroundColor: isDark ? '#151A23' : '#F8FAFC',
          }}
        >
          <View className="flex-row items-center">
            {previewBusy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="volume-high-outline" size={15} color={colors.primary} />
            )}
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
              {previewBusy ? t('textToSpeech.dynamic.loadingPreview') : t('textToSpeech.dynamic.preview')}
            </Text>
          </View>
        </Pressable>

        {!disabled ? (
          <Pressable accessibilityRole="button" onPress={onPress}>
            <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {selected ? t('textToSpeech.dynamic.selected') : t('textToSpeech.dynamic.useVoice')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function VoiceScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const { authUser } = useAppContext();
  const tier = authUser?.subscriptionTier ?? 'free';
  const characterLimit = useMemo(() => getCharacterLimit(tier), [tier]);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<TtsFormat>('mp3');
  const [libraryVoices, setLibraryVoices] = useState<AvatarVoiceOption[]>([]);
  const [clonedVoices, setClonedVoices] = useState<AvatarClonedVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SelectedVoice | null>(null);
  const [history, setHistory] = useState<TtsConversionResult[]>([]);
  const [currentResult, setCurrentResult] = useState<TtsConversionResult | null>(null);
  const [isVoicesLoading, setIsVoicesLoading] = useState(true);
  const [isClonesLoading, setIsClonesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isCloneModalVisible, setIsCloneModalVisible] = useState(false);
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [isCloneProcessingVisible, setIsCloneProcessingVisible] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [notice, setNotice] = useState('');
  const [conversionStatus, setConversionStatus] = useState<{ title: string; message: string } | null>(null);
  const [previewVoiceKey, setPreviewVoiceKey] = useState<string | null>(null);
  const [resultPlaybackBusy, setResultPlaybackBusy] = useState(false);
  const [playingResultId, setPlayingResultId] = useState<string | null>(null);
  const [ttsUsed, setTtsUsed] = useState(0);
  const [ttsLimit, setTtsLimit] = useState(() => getMonthlyTtsLimit(tier));
  const [isUsageLoading, setIsUsageLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const isMountedRef = useRef(true);
  const previewPlayerRef = useRef<AudioPlayer | null>(null);
  const previewPlayerSubRef = useRef<{ remove: () => void } | null>(null);
  const previewUriByVoiceIdRef = useRef<Record<string, string>>({});
  const resultPlayerRef = useRef<AudioPlayer | null>(null);
  const resultPlayerSubRef = useRef<{ remove: () => void } | null>(null);
  const lastConvertedVoiceKeyRef = useRef<string | null>(null);

  const characterCount = text.length;
  const remainingCharacters = Math.max(0, characterLimit - characterCount);
  const isTextTooLong = characterCount > characterLimit;
  const trimmedText = text.trim();
  const isTtsUnlimited = ttsLimit < 0;
  const remainingConversions = isTtsUnlimited ? null : Math.max(0, ttsLimit - ttsUsed);
  const isTtsLimitReached = remainingConversions === 0;

  const announceForA11y = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  const stopPreview = useCallback(() => {
    previewPlayerSubRef.current?.remove();
    previewPlayerSubRef.current = null;
    previewPlayerRef.current?.pause();
    previewPlayerRef.current?.remove();
    previewPlayerRef.current = null;
    setPreviewVoiceKey(null);
  }, []);

  const stopResultPlayback = useCallback(() => {
    resultPlayerSubRef.current?.remove();
    resultPlayerSubRef.current = null;
    resultPlayerRef.current?.pause();
    resultPlayerRef.current?.remove();
    resultPlayerRef.current = null;
    setPlayingResultId(null);
    setResultPlaybackBusy(false);
  }, []);

  const loadVoiceLibrary = useCallback(async (refresh = false) => {
    setIsVoicesLoading(true);
    try {
      const payload = await getTextToSpeechVoiceCatalog({ forceRefresh: refresh });
      if (!isMountedRef.current) return;
      const voices = payload.voices ?? [];
      setLibraryVoices(voices);
      setSelectedVoice((current) => {
        if (current && current.type === 'library' && voices.some((voice) => voice.id === current.voiceId)) {
          return current;
        }
        const fallback = payload.defaultVoice
          ? voices.find((voice) => voice.id === payload.defaultVoice)
          : voices.find((voice) => voice.default) ?? voices[0];
        return fallback
          ? { type: 'library', key: `library:${fallback.id}`, label: fallback.name, voiceId: fallback.id }
          : current;
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      setScreenError(error instanceof Error ? error.message : 'Could not load TTS voices right now.');
    } finally {
      if (isMountedRef.current) setIsVoicesLoading(false);
    }
  }, []);

  const loadClonedVoices = useCallback(async (refresh = false) => {
    setIsClonesLoading(true);
    try {
      const payload = await getTextToSpeechVoiceClones({ forceRefresh: refresh });
      if (!isMountedRef.current) return;
      setClonedVoices(payload ?? []);
    } catch (error) {
      if (!isMountedRef.current) return;
      setScreenError(error instanceof Error ? error.message : 'Could not load your cloned voices right now.');
    } finally {
      if (isMountedRef.current) setIsClonesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const payload = await getTextToSpeechHistory({ page: 1, limit: 20 });
      if (!isMountedRef.current) return;
      setHistory(payload.conversions ?? []);
    } catch (error) {
      if (!isMountedRef.current) return;
      setScreenError(error instanceof Error ? error.message : 'Could not load recent TTS conversions.');
    } finally {
      if (isMountedRef.current) setIsHistoryLoading(false);
    }
  }, []);

  const loadTtsUsage = useCallback(async (force = false) => {
    setIsUsageLoading(true);
    try {
      const usage = await getDailyUsage({ force });
      if (!isMountedRef.current) return;
      setTtsUsed(usage.ttsUsed ?? 0);
      setTtsLimit(usage.ttsLimit ?? getMonthlyTtsLimit(tier));
    } catch {
      if (!isMountedRef.current) return;
      setTtsLimit(getMonthlyTtsLimit(tier));
    } finally {
      if (isMountedRef.current) setIsUsageLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPreview();
      stopResultPlayback();
    };
  }, [stopPreview, stopResultPlayback]);

  useEffect(() => {
    void loadVoiceLibrary();
    void loadClonedVoices();
    void loadHistory();
    void loadTtsUsage();
  }, [loadClonedVoices, loadHistory, loadTtsUsage, loadVoiceLibrary]);

  useEffect(() => {
    if (isUsageLoading || !isTtsLimitReached) return;
    const message = `You've reached your monthly TTS limit. Please upgrade your plan.`;
    setScreenError(message);
    setShowUpgradePrompt(true);
  }, [isTtsLimitReached, isUsageLoading]);

  const onPreviewVoice = useCallback(async (voice: SelectedVoice) => {
    if (previewVoiceKey === voice.key) {
      stopPreview();
      return;
    }

    stopPreview();
    setScreenError('');
    setNotice('');
    setPreviewVoiceKey(voice.key);

    try {
      let uri = previewUriByVoiceIdRef.current[voice.key];
      if (!uri) {
        const bytes = await previewTextToSpeechVoice(
          voice.type === 'library' ? { voiceId: voice.voiceId } : { fishAudioId: voice.fishAudioId },
        );
        const file = new File(Paths.cache, `tts-voice-preview-${voice.key.replace(/[^a-z0-9_-]/gi, '_')}.mp3`);
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);
        uri = file.uri;
        previewUriByVoiceIdRef.current[voice.key] = uri;
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
    } catch (error) {
      stopPreview();
      setScreenError(error instanceof Error ? error.message : 'Voice preview failed.');
    }
  }, [previewVoiceKey, stopPreview]);

  const onPlayResult = useCallback(async (result: TtsConversionResult) => {
    if (playingResultId === result.id) {
      stopResultPlayback();
      return;
    }

    stopResultPlayback();
    setScreenError('');
    setNotice('');
    setResultPlaybackBusy(true);

    try {
      const { createAudioPlayer } = await getExpoAudioModule();
      const player = createAudioPlayer(result.audioUrl, { keepAudioSessionActive: true });
      resultPlayerRef.current = player;
      setPlayingResultId(result.id);
      resultPlayerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopResultPlayback();
        }
      });
      player.play();
    } catch (error) {
      stopResultPlayback();
      setScreenError(error instanceof Error ? error.message : 'Could not play this audio right now.');
    } finally {
      if (isMountedRef.current) setResultPlaybackBusy(false);
    }
  }, [playingResultId, stopResultPlayback]);

  const onDownloadAudio = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : 'Could not open the generated audio right now.');
    }
  }, []);

  const onConvert = useCallback(async () => {
    if (!trimmedText) {
      setConversionStatus(null);
      setScreenError(t('textToSpeech.dynamic.enterTextFirst'));
      announceForA11y(t('textToSpeech.dynamic.enterTextFirst'));
      return;
    }
    if (isTextTooLong) {
      setConversionStatus(null);
      setScreenError(t('textToSpeech.dynamic.characterLimit', { count: characterLimit.toLocaleString() }));
      announceForA11y(t('textToSpeech.dynamic.characterLimit', { count: characterLimit.toLocaleString() }));
      return;
    }
    if (!selectedVoice) {
      setConversionStatus(null);
      setScreenError(t('textToSpeech.dynamic.chooseVoice'));
      announceForA11y(t('textToSpeech.dynamic.chooseVoice'));
      return;
    }
    if (isTtsLimitReached) {
      const message = t('textToSpeech.dynamic.monthlyLimit');
      setConversionStatus(null);
      setScreenError(message);
      setShowUpgradePrompt(true);
      announceForA11y(message);
      return;
    }

    const conversionMessage = currentResult && lastConvertedVoiceKeyRef.current !== selectedVoice.key
      ? t('textToSpeech.dynamic.creatingVersion', { voice: selectedVoice.label })
      : t('textToSpeech.dynamic.turningIntoSpeech', { voice: selectedVoice.label });
    setConversionStatus({
      title: currentResult ? t('textToSpeech.dynamic.revoicing') : t('textToSpeech.dynamic.converting'),
      message: conversionMessage,
    });
    announceForA11y(conversionMessage);
    setIsConverting(true);
    setScreenError('');
    setShowUpgradePrompt(false);
    setNotice('');

    try {
      const payload = selectedVoice.type === 'library'
        ? { text: trimmedText, voiceId: selectedVoice.voiceId, format }
        : { text: trimmedText, fishAudioId: selectedVoice.fishAudioId, format };
      const result = await convertTextToSpeech(payload);
      if (!isMountedRef.current) return;
      setCurrentResult(result);
      setHistory((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      lastConvertedVoiceKeyRef.current = selectedVoice.key;
      setConversionStatus(null);
      setNotice(t('textToSpeech.dynamic.speechReady'));
      setTtsUsed((current) => isTtsUnlimited ? current : Math.min(ttsLimit, current + 1));
      void loadTtsUsage(true);
      announceForA11y(t('textToSpeech.dynamic.speechReadyA11y'));
    } catch (error) {
      if (!isMountedRef.current) return;
      const typed = error as { code?: string; status?: number; message?: string };
      const code = (typed.code ?? '').toUpperCase();
      const message = typed.message ?? t('textToSpeech.dynamic.conversionFailed');
      const isUpgradeError = code === 'USAGE_LIMIT_EXCEEDED' || code === 'UPGRADE_REQUIRED';
      setConversionStatus(null);
      setScreenError(message);
      setShowUpgradePrompt(isUpgradeError);
      if (code === 'USAGE_LIMIT_EXCEEDED') {
        setTtsUsed((current) => Math.max(current, ttsLimit));
      }
      announceForA11y(message);
    } finally {
      if (isMountedRef.current) setIsConverting(false);
    }
  }, [announceForA11y, characterLimit, currentResult, format, isTextTooLong, isTtsLimitReached, isTtsUnlimited, loadTtsUsage, selectedVoice, t, trimmedText, ttsLimit]);

  const onCloneVoice = useCallback(async (recording: { uri: string; fileName: string; mimeType: string }) => {
    setIsCloningVoice(true);
    setIsCloneModalVisible(false);
    setIsCloneProcessingVisible(true);
    setScreenError('');
    setNotice(t('textToSpeech.dynamic.processingRecording'));
    announceForA11y(t('textToSpeech.dynamic.processingRecordingA11y'));

    try {
      const clone = await cloneAvatarVoice({
        name: cloneVoiceName.trim(),
        audio: {
          uri: recording.uri,
          fileName: recording.fileName,
          mimeType: recording.mimeType,
        },
      });
      if (!isMountedRef.current) return;
      await loadClonedVoices(true);
      setSelectedVoice({
        type: 'clone',
        key: `clone:${clone.fishAudioId}`,
        label: clone.name,
        fishAudioId: clone.fishAudioId,
      });
      setCloneVoiceName('');
      setIsCloneProcessingVisible(false);
      setNotice(clone.status === 'ready' ? t('textToSpeech.dynamic.cloneReady') : t('textToSpeech.dynamic.sampleProcessing'));
      announceForA11y(clone.status === 'ready' ? t('textToSpeech.dynamic.cloneReady') : t('textToSpeech.dynamic.sampleProcessingA11y'));
    } catch (error) {
      if (!isMountedRef.current) return;
      setIsCloneProcessingVisible(false);
      setNotice('');
      setScreenError(error instanceof Error ? error.message : t('textToSpeech.dynamic.cloneFailed'));
      announceForA11y(error instanceof Error ? error.message : t('textToSpeech.dynamic.cloneFailed'));
    } finally {
      if (isMountedRef.current) setIsCloningVoice(false);
    }
  }, [announceForA11y, cloneVoiceName, loadClonedVoices, t]);

  const readyClones = clonedVoices.filter((voice) => voice.status === 'ready');
  const isLibraryActive = selectedVoice?.type === 'library';
  const isCloneActive = selectedVoice?.type === 'clone';
  const selectedVoiceSummary = selectedVoice
    ? selectedVoice.type === 'library'
      ? t('textToSpeech.dynamic.libraryVoice', { voice: selectedVoice.label })
      : t('textToSpeech.dynamic.clonedVoice', { voice: selectedVoice.label })
    : t('textToSpeech.dynamic.noVoiceSelected');
  const selectedLibraryVoice = selectedVoice?.type === 'library'
    ? libraryVoices.find((voice) => voice.id === selectedVoice.voiceId) ?? null
    : null;
  const latestHistoryItem = history[0] ?? null;

  return (
    <RequireAuthRoute>
      <AppScreen title={t('textToSpeech.title.textToSpeech')}>
        <VoiceCloneRecorderModal
          visible={isCloneModalVisible}
          title={t('textToSpeech.title.cloneMyVoice')}
          description="Record your voice live here. We stop automatically after 30 seconds so you can review the take before saving it."
          voiceName={cloneVoiceName}
          voiceNameLabel="Voice name"
          voiceNamePlaceholder="Example: My warm narration voice"
          voiceNameHint="Give your cloned voice a short name before recording."
          submitLabel="Use recording"
          submittingLabel="Saving voice..."
          isSubmitting={isCloningVoice}
          onChangeVoiceName={setCloneVoiceName}
          onClose={() => setIsCloneModalVisible(false)}
          onSubmitRecording={onCloneVoice}
        />

        <Modal
          visible={isVoiceModalVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setIsVoiceModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(4, 8, 14, 0.82)' : 'rgba(15, 23, 42, 0.3)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('textToSpeech.accessibilityLabel.closeVoicePicker')}
              onPress={() => setIsVoiceModalVisible(false)}
              style={{ flex: 1 }}
            />
            <View
              style={{
                maxHeight: '84%',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderWidth: 1.2,
                borderColor: colors.border,
                backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 20,
              }}
            >
              <View className="mb-4 flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                    {' '}{t('textToSpeech.ui.selectALibraryVoice')}{' '}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                    {' '}{t('textToSpeech.ui.previewVoicesThenChooseTheOneYou')}{' '}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('textToSpeech.accessibilityLabel.closeVoicePicker')}
                  onPress={() => setIsVoiceModalVisible(false)}
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

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                <View style={{ gap: 12 }}>
                  {libraryVoices.map((voice) => {
                    const item: SelectedVoice = {
                      type: 'library',
                      key: `library:${voice.id}`,
                      label: voice.name,
                      voiceId: voice.id,
                    };

                    return (
                      <VoiceChip
                        key={voice.id}
                        title={voice.name}
                        subtitle={voice.description?.trim() || formatVoiceMeta(voice)}
                        selected={selectedVoice?.key === item.key}
                        onPress={() => {
                          setSelectedVoice(item);
                          const message = trimmedText
                            ? `Selected ${item.label}. Convert again to hear your current text in this voice.`
                            : `${item.label} selected. Enter text when you are ready to convert.`;
                          setNotice(message);
                          setScreenError('');
                          announceForA11y(message);
                          setIsVoiceModalVisible(false);
                        }}
                        onPreview={() => {
                          void onPreviewVoice(item);
                        }}
                        previewBusy={previewVoiceKey === item.key}
                        colors={colors}
                        isDark={isDark}
                        statusLabel={formatVoiceMeta(voice)}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isHistoryModalVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setIsHistoryModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(4, 8, 14, 0.82)' : 'rgba(15, 23, 42, 0.3)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('textToSpeech.accessibilityLabel.closeRecentConversions')}
              onPress={() => setIsHistoryModalVisible(false)}
              style={{ flex: 1 }}
            />
            <View
              style={{
                maxHeight: '84%',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderWidth: 1.2,
                borderColor: colors.border,
                backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 20,
              }}
            >
              <View className="mb-4 flex-row items-start justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                    {' '}{t('textToSpeech.ui.recentConversions')}{' '}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                    {' '}{t('textToSpeech.ui.browseAndReplayYourRecentTextTo')}{' '}</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="mr-2">
                    <AppButton
                      label={t('textToSpeech.label.refresh')}
                      onPress={() => {
                        void loadHistory();
                      }}
                      iconName="refresh-outline"
                      variant="outline"
                      compact
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('textToSpeech.accessibilityLabel.closeRecentConversions')}
                    onPress={() => setIsHistoryModalVisible(false)}
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
              </View>

              {isHistoryLoading ? (
                <View className="items-center justify-center" style={{ paddingVertical: 28 }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
                    {' '}{t('textToSpeech.ui.loadingRecentConversions')}{' '}</Text>
                </View>
              ) : history.length === 0 ? (
                <NoticeCard
                  title={t('textToSpeech.title.noRecentConversions')}
                  message={t('textToSpeech.dynamic.emptyHistory')}
                  tone="info"
                  colors={colors}
                  isDark={isDark}
                />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <View style={{ gap: 10 }}>
                    {history.map((item) => (
                      <View
                        key={item.id}
                        className="rounded-[22px] border p-4"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#10151D' : '#F8FAFC',
                        }}
                      >
                        <View className="flex-row items-start justify-between">
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                              {item.voiceName || item.voiceId || 'Voice output'}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                              {item.format.toUpperCase()} - {item.characterCount ?? item.text.length} {' '}{t('textToSpeech.ui.chars')}{' '}{formatRelativeTimestamp(item.createdAt)}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              void onDownloadAudio(item.audioUrl);
                            }}
                            className="rounded-full px-3 py-2"
                            style={{
                              borderWidth: 1.2,
                              borderColor: colors.border,
                              backgroundColor: isDark ? '#11161F' : '#FFFFFF',
                            }}
                          >
                            <Ionicons name="download-outline" size={16} color={colors.primary} />
                          </Pressable>
                        </View>
                        <Text numberOfLines={3} style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>
                          {item.text}
                        </Text>
                        <View className="mt-4">
                          <AppButton
                            label={playingResultId === item.id ? t('textToSpeech.dynamic.stopAudio') : t('textToSpeech.dynamic.playAudio')}
                            onPress={() => {
                              if (!resultPlaybackBusy) {
                                void onPlayResult(item);
                              }
                            }}
                            iconName={playingResultId === item.id ? 'stop-circle-outline' : 'play-outline'}
                            variant="outline"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View
            className="mb-4 rounded-[28px] border p-4"
            style={{
              borderColor: `${colors.primary}28`,
              backgroundColor: isDark ? '#0D1220' : '#F8FBFF',
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>
              {' '}{t('textToSpeech.ui.turnTextIntoAudio')}{' '}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
              {' '}{t('textToSpeech.ui.useTheVoiceLibraryOrOneOf')}{' '}</Text>

            <View className="mt-4 flex-row flex-wrap">
              <View
                className="mr-2 mb-2 rounded-full px-3 py-2"
                style={{ backgroundColor: `${colors.primary}16` }}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  {' '}{t('textToSpeech.ui.plan')}{' '}{formatTierLabel(tier)}
                </Text>
              </View>
              <View
                className="mr-2 mb-2 rounded-full px-3 py-2"
                style={{ backgroundColor: isDark ? '#171E2A' : '#FFFFFF' }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                  {' '}{t('textToSpeech.ui.limit')}{' '}{characterLimit.toLocaleString()} {' '}{t('textToSpeech.ui.chars2')}{' '}</Text>
              </View>
              <View
                className="mb-2 rounded-full px-3 py-2"
                style={{ backgroundColor: isTtsLimitReached ? 'rgba(220,38,38,0.12)' : (isDark ? '#171E2A' : '#FFFFFF') }}
              >
                <Text style={{ color: isTtsLimitReached ? '#DC2626' : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                  {isUsageLoading
                    ? t('textToSpeech.dynamic.loadingUsage')
                    : isTtsUnlimited
                      ? t('textToSpeech.dynamic.unlimitedConversions')
                      : t('textToSpeech.dynamic.conversionsRemaining', { count: String(remainingConversions ?? 0) })}
                </Text>
              </View>
              <View
                className="mb-2 rounded-full px-3 py-2"
                style={{ backgroundColor: isDark ? '#171E2A' : '#FFFFFF' }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                  {' '}{t('textToSpeech.ui.format')}{' '}{format.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View
            className="mb-4 rounded-[28px] border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
                {' '}{t('textToSpeech.ui.script')}{' '}</Text>
              <Text style={{ color: isTextTooLong ? '#DC2626' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                {characterCount.toLocaleString()} / {characterLimit.toLocaleString()}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
              {' '}{t('textToSpeech.ui.remainingCharacters')}{' '}{remainingCharacters.toLocaleString()}
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('textToSpeech.placeholder.typeOrPasteTheTextYouWant')}
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 160,
                marginTop: 14,
                borderRadius: 20,
                borderWidth: 1.2,
                borderColor: isTextTooLong ? '#FCA5A5' : colors.border,
                backgroundColor: isDark ? '#11161F' : '#F8FAFC',
                paddingHorizontal: 14,
                paddingVertical: 14,
                color: colors.textPrimary,
                fontSize: 14,
                lineHeight: 22,
              }}
            />

            <View className="mt-4 flex-row items-center justify-between">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {selectedVoiceSummary}
              </Text>
              <View className="flex-row">
                {(['mp3', 'wav'] as TtsFormat[]).map((entry) => {
                  const selected = format === entry;
                  return (
                    <Pressable
                      key={entry}
                      accessibilityRole="button"
                      onPress={() => setFormat(entry)}
                      className="ml-2 rounded-full px-3 py-2"
                      style={{
                        borderWidth: 1.2,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${colors.primary}14` : 'transparent',
                      }}
                    >
                      <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                        {entry.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-4">
              <AppButton
                label={isConverting ? t('textToSpeech.dynamic.convertingProgress') : t('textToSpeech.dynamic.convertToSpeech')}
                onPress={() => {
                  if (!isConverting) {
                    void onConvert();
                  }
                }}
                iconName="volume-high-outline"
              />
            </View>
          </View>

          {screenError ? (
            <View className="mb-4">
              <NoticeCard message={screenError} tone="error" colors={colors} isDark={isDark} />
              {showUpgradePrompt ? (
                <View className="mt-3">
                  <AppButton
                    label={t('textToSpeech.label.viewUpgradeOptions')}
                    iconName="arrow-up-circle-outline"
                    onPress={() => router.push('/(drawer)/plans')}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isCloneProcessingVisible ? (
            <ProcessingCard
              title={t('textToSpeech.title.processingYourVoice')}
              message={t('textToSpeech.dynamic.preparingClone')}
              colors={colors}
              isDark={isDark}
            />
          ) : null}

          {conversionStatus ? (
            <ProcessingCard
              title={conversionStatus.title}
              message={conversionStatus.message}
              colors={colors}
              isDark={isDark}
            />
          ) : null}

          {notice ? (
            <View className="mb-4">
              <NoticeCard message={notice} tone="success" colors={colors} isDark={isDark} />
            </View>
          ) : null}

          {currentResult ? (
            <View
              className="mb-4 rounded-[28px] border p-4"
              style={{
                borderColor: `${colors.primary}30`,
                backgroundColor: isDark ? '#0D1420' : '#FFFFFF',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
                {' '}{t('textToSpeech.ui.latestResult')}{' '}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                {currentResult.format.toUpperCase()} • {currentResult.duration ? `${currentResult.duration}s` : 'Duration pending'} • {formatRelativeTimestamp(currentResult.createdAt)}
              </Text>
              <Text numberOfLines={4} style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>
                {currentResult.text}
              </Text>
              <View className="mt-4 flex-row flex-wrap">
                <View className="mr-2 mb-2">
                  <AppButton
                    label={playingResultId === currentResult.id ? t('textToSpeech.dynamic.stopAudio') : (resultPlaybackBusy ? t('textToSpeech.dynamic.opening') : t('textToSpeech.dynamic.playAudio'))}
                    onPress={() => {
                      if (!resultPlaybackBusy) {
                        void onPlayResult(currentResult);
                      }
                    }}
                    iconName={playingResultId === currentResult.id ? 'stop-circle-outline' : 'play-outline'}
                  />
                </View>
                <View className="mr-2 mb-2">
                  <AppButton
                    label={t('textToSpeech.label.download')}
                    onPress={() => {
                      void onDownloadAudio(currentResult.audioUrl);
                    }}
                    iconName="download-outline"
                    variant="outline"
                  />
                </View>
              </View>
            </View>
          ) : null}

          <View
            className="mb-4 rounded-[28px] border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
                {' '}{t('textToSpeech.ui.libraryVoices')}{' '}</Text>
              {isVoicesLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
              {' '}{t('textToSpeech.ui.onlyOneVoiceCanBeActiveAt')}{' '}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('textToSpeech.accessibilityLabel.openLibraryVoiceSelector')}
              accessibilityHint={t('textToSpeech.accessibilityHint.showsTheFullVoiceLibraryInA')}
              onPress={() => setIsVoiceModalVisible(true)}
              className="mt-4 rounded-[22px] border p-4"
              style={{
                borderColor: isLibraryActive ? `${colors.primary}40` : colors.border,
                backgroundColor: isLibraryActive
                  ? (isDark ? '#11192A' : '#EEF4FF')
                  : (isDark ? '#10151D' : '#F8FAFC'),
              }}
            >
              <View className="flex-row items-center justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <View className="flex-row items-center">
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
                      {selectedLibraryVoice ? selectedLibraryVoice.name : 'Choose a library voice'}
                    </Text>
                    <View
                      className="ml-2 rounded-full px-2.5 py-1"
                      style={{ backgroundColor: isLibraryActive ? `${colors.primary}18` : (isDark ? '#161C26' : '#E5E7EB') }}
                    >
                      <Text style={{ color: isLibraryActive ? colors.primary : colors.textSecondary, fontSize: 10, fontWeight: '800' }}>
                        {isLibraryActive ? 'ACTIVE' : 'INACTIVE'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                    {isCloneActive
                      ? 'A cloned voice is currently active. Selecting a library voice will switch to it.'
                      : selectedLibraryVoice
                      ? (selectedLibraryVoice.description?.trim() || formatVoiceMeta(selectedLibraryVoice))
                      : 'Open the modal to preview and select from the available voices.'}
                  </Text>
                </View>
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${colors.primary}14` }}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          </View>

          <View
            className="mb-4 rounded-[28px] border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
                {' '}{t('textToSpeech.ui.clonedVoices')}{' '}</Text>
              {isClonesLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
              {' '}{t('textToSpeech.ui.onlyOneVoiceCanBeActiveAt2')}{' '}</Text>

            {isCloneActive ? (
              <View
                className="mt-4 rounded-[18px] border px-4 py-3"
                style={{
                  borderColor: `${colors.primary}35`,
                  backgroundColor: isDark ? '#11192A' : '#EEF4FF',
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                  {' '}{t('textToSpeech.ui.activeCLONEDVOICE')}{' '}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 6 }}>
                  {selectedVoice?.label}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                  {' '}{t('textToSpeech.ui.thisIsTheOnlyVoiceThatWill')}{' '}</Text>
              </View>
            ) : null}

            <View className="mt-4">
              <AppButton
                label={isCloningVoice ? t('textToSpeech.dynamic.uploadingSample') : t('textToSpeech.title.cloneMyVoice')}
                onPress={() => {
                  if (!isCloningVoice) {
                    setCloneVoiceName('');
                    setIsCloneProcessingVisible(false);
                    setIsCloneModalVisible(true);
                  }
                }}
                iconName="mic-outline"
                variant="outline"
              />
            </View>

            <View style={{ marginTop: 14, gap: 12 }}>
              {clonedVoices.length === 0 ? (
                <NoticeCard
                  title={t('textToSpeech.title.noClonedVoicesYet')}
                  message={t('textToSpeech.dynamic.noClonesMessage')}
                  tone="info"
                  colors={colors}
                  isDark={isDark}
                />
              ) : readyClones.length === 0 ? (
                <NoticeCard
                  title={t('textToSpeech.title.clonedVoicesAreProcessing')}
                  message={t('textToSpeech.dynamic.clonesProcessingMessage')}
                  tone="info"
                  colors={colors}
                  isDark={isDark}
                />
              ) : (
                clonedVoices.map((voice) => {
                  const item: SelectedVoice = {
                    type: 'clone',
                    key: `clone:${voice.fishAudioId}`,
                    label: voice.name,
                    fishAudioId: voice.fishAudioId,
                  };
                  const isReady = voice.status === 'ready';
                  return (
                    <VoiceChip
                      key={voice.fishAudioId}
                      title={voice.name}
                      subtitle={t('textToSpeech.subtitle.yourSavedClonedVoice')}
                      selected={selectedVoice?.key === item.key}
                      onPress={() => {
                        if (!isReady) return;
                        setSelectedVoice(item);
                        const message = trimmedText
                          ? `Selected ${item.label}. Convert again to hear your current text in this voice.`
                          : `${item.label} selected. Enter text when you are ready to convert.`;
                        setNotice(message);
                        setScreenError('');
                        announceForA11y(message);
                      }}
                      onPreview={() => {
                        if (!isReady) return;
                        void onPreviewVoice(item);
                      }}
                      previewBusy={previewVoiceKey === item.key}
                      colors={colors}
                      isDark={isDark}
                      statusLabel={isReady ? 'Ready to use' : `Status: ${voice.status}`}
                      disabled={!isReady}
                    />
                  );
                })
              )}
            </View>
          </View>

          <View
            className="mb-4 rounded-[28px] border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
            }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
                  {' '}{t('textToSpeech.ui.recentConversions')}{' '}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                  {' '}{t('textToSpeech.ui.openYourRecentTextToSpeechJobs')}{' '}</Text>
              </View>
            </View>

            {isHistoryLoading ? (
              <View className="items-center justify-center" style={{ paddingVertical: 28 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
                  {' '}{t('textToSpeech.ui.loadingRecentConversions')}{' '}</Text>
              </View>
            ) : history.length === 0 ? (
              <View style={{ marginTop: 14 }}>
                <NoticeCard
                  title={t('textToSpeech.title.noRecentConversions')}
                  message={t('textToSpeech.dynamic.emptyHistory')}
                  tone="info"
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            ) : false ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                {history.map((item) => (
                  <View
                    key={item.id}
                    className="rounded-[22px] border p-4"
                    style={{
                      borderColor: colors.border,
                      backgroundColor: isDark ? '#10151D' : '#F8FAFC',
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                          {item.voiceName || item.voiceId || 'Voice output'}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                          {item.format.toUpperCase()} • {item.characterCount ?? item.text.length} {' '}{t('textToSpeech.ui.chars3')}{' '}{formatRelativeTimestamp(item.createdAt)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          void onDownloadAudio(item.audioUrl);
                        }}
                        className="rounded-full px-3 py-2"
                        style={{
                          borderWidth: 1.2,
                          borderColor: colors.border,
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color={colors.primary} />
                      </Pressable>
                    </View>
                    <Text numberOfLines={3} style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>
                      {item.text}
                    </Text>
                    <View className="mt-4">
                      <AppButton
                        label={playingResultId === item.id ? t('textToSpeech.dynamic.stopAudio') : t('textToSpeech.dynamic.playAudio')}
                        onPress={() => {
                          if (!resultPlaybackBusy) {
                            void onPlayResult(item);
                          }
                        }}
                        iconName={playingResultId === item.id ? 'stop-circle-outline' : 'play-outline'}
                        variant="outline"
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('textToSpeech.accessibilityLabel.openRecentConversions')}
                accessibilityHint={t('textToSpeech.accessibilityHint.showsYourRecentTextToSpeechHistory')}
                onPress={() => setIsHistoryModalVisible(true)}
                className="mt-4 rounded-[22px] border p-4"
                style={{
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#10151D' : '#F8FAFC',
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
                      {latestHistoryItem?.voiceName || latestHistoryItem?.voiceId || 'Voice output'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                      {latestHistoryItem
                        ? `${latestHistoryItem.format.toUpperCase()} - ${latestHistoryItem.characterCount ?? latestHistoryItem.text.length} chars - ${formatRelativeTimestamp(latestHistoryItem.createdAt)}`
                        : 'Open your recent conversions.'}
                    </Text>
                    {latestHistoryItem ? (
                      <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19, marginTop: 10 }}>
                        {latestHistoryItem.text}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${colors.primary}14` }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </View>
                </View>

                <View className="mt-4 flex-row items-center justify-between">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    {history.length} {' '}{t('textToSpeech.ui.savedConversion')}{history.length === 1 ? '' : 's'}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                    {' '}{t('textToSpeech.ui.tapToBrowse')}{' '}</Text>
                </View>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}
