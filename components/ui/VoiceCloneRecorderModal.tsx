import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { RecordingWaves } from '@/components/chat';
import { useAppTheme } from '@/hooks';

import { AppButton } from './AppButton';

const MAX_RECORDING_SECONDS = 30;
const MIN_RECORDING_MILLIS = 10_000;

type VoiceCloneRecording = {
  uri: string;
  fileName: string;
  mimeType: string;
  durationMillis: number;
};

type VoiceCloneRecorderModalProps = {
  visible: boolean;
  title: string;
  description: string;
  voiceName: string;
  voiceNameLabel: string;
  voiceNamePlaceholder: string;
  voiceNameHint: string;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onChangeVoiceName: (value: string) => void;
  onClose: () => void;
  onSubmitRecording: (recording: VoiceCloneRecording) => Promise<void>;
  onAnnounce?: (message: string) => void;
};

function formatSecondsLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function describeRecordingError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return {
      message: JSON.stringify(error),
      raw: error,
    };
  } catch {
    return {
      message: String(error),
      raw: error,
    };
  }
}

function logVoiceCloneRecorder(label: string, payload?: unknown) {
  console.log(`[voice-clone-recorder:${label}]`, payload ?? '');
}

async function cleanupFile(uri?: string | null) {
  if (!uri?.startsWith('file://')) return;
  try {
    await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Ignore cache cleanup issues for temporary recordings.
  }
}

export function VoiceCloneRecorderModal({
  visible,
  ...props
}: VoiceCloneRecorderModalProps) {
  if (!visible) {
    return null;
  }

  return <VoiceCloneRecorderModalContent visible={visible} {...props} />;
}

function VoiceCloneRecorderModalContent({
  visible,
  title,
  description,
  voiceName,
  voiceNameLabel,
  voiceNamePlaceholder,
  voiceNameHint,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onChangeVoiceName,
  onClose,
  onSubmitRecording,
  onAnnounce,
}: VoiceCloneRecorderModalProps) {
  const { colors, isDark } = useAppTheme();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
    keepAudioRecordingOnBackground: false,
  }, (status) => {
    if (status.hasError || status.error) {
      logVoiceCloneRecorder('native-status-error', status);
    }
    if (status.isFinished) {
      logVoiceCloneRecorder('native-status-finished', status);
    }
  });
  const recorderState = useAudioRecorderState(recorder, 150);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'review'>('idle');
  const [recordingError, setRecordingError] = useState('');
  const [recording, setRecording] = useState<VoiceCloneRecording | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const announcedTimeRef = useRef<Set<number>>(new Set());
  const capturedUrlRef = useRef<string | null>(null);
  const latestCleanupRecordingUriRef = useRef<string | null>(null);
  const latestPhaseRef = useRef<'idle' | 'recording' | 'review'>('idle');
  const latestIsRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const latestDurationMillisRef = useRef(0);
  const previewPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const previewPlayerSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
    onAnnounce?.(message);
  }, [onAnnounce]);

  useEffect(() => {
    latestPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    latestIsRecordingRef.current = recorderState.isRecording;
  }, [recorderState.isRecording]);

  useEffect(() => {
    latestDurationMillisRef.current = Math.max(latestDurationMillisRef.current, recorderState.durationMillis);
  }, [recorderState.durationMillis]);

  useEffect(() => {
    latestCleanupRecordingUriRef.current = recording?.uri ?? null;
  }, [recording]);

  const stopPreviewPlayback = useCallback(() => {
    previewPlayerSubscriptionRef.current?.remove();
    previewPlayerSubscriptionRef.current = null;
    previewPlayerRef.current?.pause();
    previewPlayerRef.current?.remove();
    previewPlayerRef.current = null;
    setIsPlayingPreview(false);
  }, []);

  const resetRecorderState = useCallback(async (options?: { cleanupCurrentRecording?: boolean }) => {
    logVoiceCloneRecorder('reset-start', {
      cleanupCurrentRecording: options?.cleanupCurrentRecording ?? false,
      isRecording: latestIsRecordingRef.current,
      phase: latestPhaseRef.current,
    });
    announcedTimeRef.current.clear();
    capturedUrlRef.current = null;
    recordingStartedAtRef.current = null;
    latestDurationMillisRef.current = 0;
    stopPreviewPlayback();
    setPhase('idle');
    setRecordingError('');
    setIsPreparing(false);
    const currentRecordingUri = options?.cleanupCurrentRecording ? latestCleanupRecordingUriRef.current : null;
    latestCleanupRecordingUriRef.current = null;
    setRecording(null);
    if (options?.cleanupCurrentRecording) {
      void cleanupFile(currentRecordingUri);
    }
    try {
      if (latestIsRecordingRef.current) {
        logVoiceCloneRecorder('reset-stop-active-recorder');
        await recorder.stop();
      }
    } catch (error) {
      logVoiceCloneRecorder('reset-stop-error', describeRecordingError(error));
    }
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch (error) {
      logVoiceCloneRecorder('reset-audio-mode-error', describeRecordingError(error));
    }
    logVoiceCloneRecorder('reset-complete');
  }, [recorder, stopPreviewPlayback]);

  useEffect(() => {
    if (!visible) {
      void resetRecorderState({ cleanupCurrentRecording: true });
    }
  }, [resetRecorderState, visible]);

  useEffect(() => {
    return () => {
      void resetRecorderState({ cleanupCurrentRecording: true });
    };
  }, [resetRecorderState]);

  useEffect(() => {
    if (phase !== 'recording') return;

    const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - Math.floor(recorderState.durationMillis / 1000));
    if ([20, 10, 5].includes(remainingSeconds) && !announcedTimeRef.current.has(remainingSeconds)) {
      announcedTimeRef.current.add(remainingSeconds);
      announce(`${remainingSeconds} seconds remaining.`);
    }
  }, [announce, phase, recorderState.durationMillis]);

  useEffect(() => {
    if (phase !== 'recording' || recorderState.isRecording || !recorderState.url || capturedUrlRef.current === recorderState.url) {
      return;
    }

    const elapsedFromStart = recordingStartedAtRef.current
      ? Math.max(0, Date.now() - recordingStartedAtRef.current)
      : 0;
    const finalDurationMillis = Math.max(
      latestDurationMillisRef.current,
      recorderState.durationMillis,
      elapsedFromStart,
    );
    logVoiceCloneRecorder('recording-finished', {
      durationMillis: finalDurationMillis,
      url: recorderState.url,
    });
    capturedUrlRef.current = recorderState.url;
    latestDurationMillisRef.current = finalDurationMillis;
    recordingStartedAtRef.current = null;
    setPhase('review');
    setRecording({
      uri: recorderState.url,
      fileName: `voice-clone-${Date.now()}.m4a`,
      mimeType: 'audio/m4a',
      durationMillis: finalDurationMillis,
    });
    void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    announce('Recording complete. Review it before saving your voice.');
  }, [announce, phase, recorderState.durationMillis, recorderState.isRecording, recorderState.url]);

  const startRecording = useCallback(async () => {
    if (isPreparing || phase === 'recording' || isSubmitting) return;
    if (!voiceName.trim()) {
      setRecordingError('Give your voice a short name before you record.');
      announce('Give your voice a short name before you record.');
      return;
    }

    setRecordingError('');
    stopPreviewPlayback();
    setRecording((current) => {
      void cleanupFile(current?.uri);
      return null;
    });
    setIsPreparing(true);
    logVoiceCloneRecorder('start-attempt', {
      voiceNameLength: voiceName.trim().length,
      phase,
    });

    try {
      const permission = await requestRecordingPermissionsAsync();
      logVoiceCloneRecorder('permission-response', permission);
      if (!permission.granted) {
        throw new Error(
          permission.canAskAgain
            ? 'Microphone access is needed to record your voice sample.'
            : 'Microphone access is blocked. Open Settings to allow recording.',
        );
      }

      logVoiceCloneRecorder('audio-mode-enable');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      logVoiceCloneRecorder('prepare-start');
      await recorder.prepareToRecordAsync();
      logVoiceCloneRecorder('prepare-complete', recorder.getStatus());
      announcedTimeRef.current.clear();
      capturedUrlRef.current = null;
      latestDurationMillisRef.current = 0;
      recordingStartedAtRef.current = Date.now();
      setPhase('recording');
      logVoiceCloneRecorder('record-start');
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      announce('Recording started. Speak clearly. Recording will stop automatically after 30 seconds.');
    } catch (error) {
      const details = describeRecordingError(error);
      logVoiceCloneRecorder('start-error', details);
      const message = details.message || 'Recording could not start right now.';
      setRecordingError(message);
      announce(message);
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (audioModeError) {
        logVoiceCloneRecorder('start-error-audio-mode-reset-failed', describeRecordingError(audioModeError));
      }
    } finally {
      setIsPreparing(false);
      logVoiceCloneRecorder('start-finished', recorder.getStatus());
    }
  }, [announce, isPreparing, isSubmitting, phase, recorder, stopPreviewPlayback, voiceName]);

  const onRecordAgain = useCallback(async () => {
    if (isSubmitting) return;
    await resetRecorderState({ cleanupCurrentRecording: true });
    await startRecording();
  }, [isSubmitting, resetRecorderState, startRecording]);

  const onTogglePreviewPlayback = useCallback(async () => {
    if (!recording) return;
    if (isPlayingPreview) {
      stopPreviewPlayback();
      return;
    }

    stopPreviewPlayback();
    logVoiceCloneRecorder('preview-play-start', {
      uri: recording.uri,
      durationMillis: recording.durationMillis,
    });
    try {
      const player = createAudioPlayer(recording.uri, { keepAudioSessionActive: true });
      previewPlayerRef.current = player;
      previewPlayerSubscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopPreviewPlayback();
        }
      });
      setIsPlayingPreview(true);
      player.play();
    } catch (error) {
      logVoiceCloneRecorder('preview-play-error', describeRecordingError(error));
      stopPreviewPlayback();
      const message = error instanceof Error ? error.message : 'Preview playback could not start.';
      setRecordingError(message);
      announce(message);
    }
  }, [announce, isPlayingPreview, recording, stopPreviewPlayback]);

  const onUseRecording = useCallback(async () => {
    if (!recording || isSubmitting) return;
    if (recording.durationMillis < MIN_RECORDING_MILLIS) {
      setRecordingError('Record at least 10 seconds so your cloned voice sounds right.');
      announce('Record at least 10 seconds so your cloned voice sounds right.');
      return;
    }

    const info = await LegacyFileSystem.getInfoAsync(recording.uri);
    if (!info.exists) {
      const message = 'That recording is no longer available. Please record again.';
      setRecordingError(message);
      announce(message);
      return;
    }
    if (typeof info.size === 'number' && info.size > 50 * 1024 * 1024) {
      const message = 'That recording is too large. Please record a shorter sample.';
      setRecordingError(message);
      announce(message);
      return;
    }

    setRecordingError('');
    logVoiceCloneRecorder('submit-recording', {
      durationMillis: recording.durationMillis,
      uri: recording.uri,
      fileName: recording.fileName,
      mimeType: recording.mimeType,
    });
    await onSubmitRecording(recording);
  }, [announce, isSubmitting, onSubmitRecording, recording]);

  const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - Math.floor(recorderState.durationMillis / 1000));
  const isRecording = phase === 'recording';
  const canDismiss = !isRecording && !isSubmitting && !isPreparing;
  const needsLongerSample = Boolean(recording) && recording.durationMillis < MIN_RECORDING_MILLIS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (canDismiss) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(4, 8, 14, 0.82)' : 'rgba(15, 23, 42, 0.3)',
          justifyContent: 'flex-end',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canDismiss ? `Close ${title}` : 'Recording in progress'}
          accessibilityHint={canDismiss ? 'Closes this voice recorder.' : 'Recording must finish before this screen can close.'}
          disabled={!canDismiss}
          onPress={onClose}
          style={{ flex: 1 }}
        />

        <View
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1.2,
            borderColor: isRecording ? colors.danger : colors.border,
            backgroundColor: isDark ? '#0C1017' : '#FFFFFF',
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '800' }}>
                {title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {description}
              </Text>
            </View>
            {canDismiss ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close ${title}`}
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
            ) : null}
          </View>

          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
            {voiceNameLabel}
          </Text>
          <TextInput
            value={voiceName}
            onChangeText={onChangeVoiceName}
            editable={!isRecording && !isSubmitting}
            placeholder={voiceNamePlaceholder}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={voiceNameLabel}
            accessibilityHint={voiceNameHint}
            style={{
              borderWidth: 1.2,
              borderColor: isRecording ? colors.danger : colors.border,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 12,
              color: colors.textPrimary,
              backgroundColor: isDark ? '#11151D' : '#FFFFFF',
              opacity: isRecording ? 0.8 : 1,
            }}
          />

          <View
            className="mt-4 rounded-[24px] border px-4 py-4"
            accessible
            accessibilityLabel={
              isRecording
                ? `Recording now. ${remainingSeconds} seconds remaining.`
                : phase === 'review'
                  ? `Recording complete. Length ${formatSecondsLabel(Math.ceil((recording?.durationMillis ?? 0) / 1000))}.`
                  : 'Recorder ready.'
            }
            style={{
              borderColor: isRecording ? colors.danger : colors.border,
              backgroundColor: isRecording ? (isDark ? '#2A1116' : '#FFF1F2') : (isDark ? '#11151D' : '#F8FAFC'),
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ flex: 1, paddingRight: 12 }}>
                <View
                  className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isRecording ? colors.danger : `${colors.primary}14`,
                  }}
                >
                  <Ionicons
                    name={isRecording ? 'radio' : phase === 'review' ? 'checkmark-circle' : 'mic'}
                    size={22}
                    color={isRecording ? '#FFFFFF' : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
                    {isRecording ? 'Recording now' : phase === 'review' ? 'Recording ready to review' : 'Ready to record'}
                  </Text>
                  <Text style={{ color: isRecording ? colors.danger : colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '700' }}>
                    {isRecording
                      ? 'Do not leave this screen. Recording stops automatically after 30 seconds.'
                      : phase === 'review'
                        ? 'Use this take or record again.'
                        : 'Speak for at least 10 seconds for the best clone quality.'}
                  </Text>
                </View>
              </View>

              <View
                className="rounded-full px-3 py-2"
                style={{
                  backgroundColor: isRecording ? '#FFFFFF' : `${colors.primary}10`,
                }}
              >
                <Text style={{ color: isRecording ? colors.danger : colors.primary, fontSize: 16, fontWeight: '900' }}>
                  {formatSecondsLabel(isRecording ? remainingSeconds : Math.ceil((recording?.durationMillis ?? 0) / 1000))}
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-[18px] px-4 py-4" style={{ backgroundColor: isDark ? '#0B0F16' : '#FFFFFF' }}>
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                  {isRecording ? 'Microphone live' : phase === 'review' ? 'Captured sample' : 'Before you start'}
                </Text>
                {isRecording ? (
                  <View className="flex-row items-center">
                    <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.danger }} />
                    <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '900' }}>
                      REC
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1, paddingRight: 12 }}>
                  {isRecording
                    ? 'We are recording your voice right now. Keep speaking until the timer reaches zero.'
                    : phase === 'review'
                      ? needsLongerSample
                        ? 'This take is too short. Record again and keep speaking for at least 10 seconds.'
                        : 'Play this take to check it, then save it or record a fresh sample.'
                      : 'Find a quiet place, hold the phone steadily, and say a few natural sentences in your normal voice.'}
                </Text>
                {isRecording ? <RecordingWaves color={colors.danger} /> : <Ionicons name="mic-outline" size={22} color={colors.primary} />}
              </View>
            </View>
          </View>

          {recordingError ? (
            <View
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{
                borderColor: '#FCA5A5',
                backgroundColor: isDark ? '#2A1116' : '#FFF1F2',
              }}
            >
              <Text style={{ color: isDark ? '#FECACA' : '#B91C1C', fontSize: 12, lineHeight: 18, fontWeight: '700' }}>
                {recordingError}
              </Text>
              {recordingError.includes('Open Settings') ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                  className="mt-3 self-start rounded-full px-3 py-2"
                  style={{
                    borderWidth: 1,
                    borderColor: '#FCA5A5',
                    backgroundColor: isDark ? '#3A1720' : '#FFFFFF',
                  }}
                >
                  <Text style={{ color: isDark ? '#FECACA' : '#B91C1C', fontSize: 12, fontWeight: '800' }}>
                    Open Settings
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View className="mt-5 flex-row flex-wrap" style={{ gap: 10 }}>
            {phase === 'idle' ? (
              <>
                <AppButton
                  label={isPreparing ? 'Starting mic...' : 'Start recording'}
                  iconName="radio-outline"
                  onPress={() => {
                    void startRecording();
                  }}
                />
                <AppButton label="Not now" variant="outline" onPress={onClose} />
              </>
            ) : null}

            {phase === 'review' ? (
              <>
                <AppButton
                  label={isPlayingPreview ? 'Stop preview' : 'Play recording'}
                  variant="outline"
                  iconName={isPlayingPreview ? 'stop-circle-outline' : 'play-outline'}
                  onPress={() => {
                    void onTogglePreviewPlayback();
                  }}
                />
                {needsLongerSample ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled
                    className="rounded-full px-4 py-3"
                    style={{
                      backgroundColor: isDark ? '#1B2433' : '#E2E8F0',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                      Record at least 10s
                    </Text>
                  </Pressable>
                ) : (
                  <AppButton
                    label={isSubmitting ? submittingLabel : submitLabel}
                    iconName="checkmark-circle-outline"
                    onPress={() => {
                      void onUseRecording();
                    }}
                  />
                )}
                <AppButton
                  label="Record again"
                  variant="outline"
                  iconName="refresh-outline"
                  onPress={() => {
                    void onRecordAgain();
                  }}
                />
              </>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
