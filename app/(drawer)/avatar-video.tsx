import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { router, type Href } from 'expo-router';

import { AppButton, AppScreen, ChatVideoCard, RequireAuthRoute, VoiceCloneRecorderModal } from '@/components';
import { pickRandomAvatarScriptPreset } from '@/features/avatar/data/avatarRandomScriptPool';
import {
  cloneAvatarVoice,
  cancelAvatarVideo,
  generateAvatarScript,
  generateAvatarVideo,
  getAvatarGallery,
  getAvatarHistory,
  getAvatarVideoStatus,
  getAvatarVoiceCatalog,
  getAvatarVoiceClones,
  previewAvatarVoice,
  uploadAvatarImage,
} from '@/features';
import { useAppTheme } from '@/hooks';
import {
  clearPendingAvatarVideoJob,
  getPendingAvatarVideoJob,
  setPendingAvatarVideoJob,
} from '@/services';
import type {
  AvatarClonedVoice,
  AvatarDurationSeconds,
  AvatarGalleryGender,
  AvatarGalleryItem,
  AvatarGalleryStyle,
  AvatarHistoryItem,
  AvatarJobStatus,
  AvatarVoiceCategory,
  AvatarScriptTone,
  AvatarUseCaseTemplate,
  AvatarVideoStatus,
  AvatarVoiceOption,
  PendingAvatarVideoJob,
} from '@/types';
import {
  hapticError,
  hapticSuccess,
  IOS_PHOTO_PERMISSION_DENIED_CODE,
  saveMediaToCafaAlbum,
} from '@/utils';
import { pickSingleImageFromLibrary } from '@/utils/deviceImagePicker';

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
    throw new Error('Audio playback is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

const GENDER_FILTERS: { value: AvatarGalleryGender | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'neutral', label: 'Neutral' },
];

const STYLE_FILTERS: { value: AvatarGalleryStyle | ''; label: string }[] = [
  { value: '', label: 'All styles' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'creative', label: 'Creative' },
];

const TONE_OPTIONS: { value: AvatarScriptTone; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'educational', label: 'Educational' },
];

const FIXED_DURATION_SECONDS: AvatarDurationSeconds = 15;

const USE_CASE_OPTIONS: { value: AvatarUseCaseTemplate; label: string }[] = [
  { value: 'product ad', label: 'Product ad' },
  { value: 'intro', label: 'Intro' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'general', label: 'General' },
];

const VOICE_GENDER_FILTERS: { value: '' | 'male' | 'female'; label: string }[] = [
  { value: '', label: 'All voices' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const VOICE_CATEGORY_FILTERS: { value: '' | AvatarVoiceCategory; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'professional', label: 'Professional' },
  { value: 'african', label: 'African' },
  { value: 'creative', label: 'Creative' },
  { value: 'entertainment', label: 'Entertainment' },
];

const POLL_INTERVAL_MS = 12_000;
const HISTORY_LIMIT = 12;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type UploadedAvatar = {
  imageUrl: string;
  localUri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type CurrentAvatarResult = {
  status: AvatarVideoStatus;
  meta: PendingAvatarVideoJob;
};

type FailedAvatarResult = {
  status: AvatarVideoStatus;
  meta: PendingAvatarVideoJob;
};

type SelectedAvatarVoice =
  | { kind: 'library'; voiceId: string; label: string }
  | { kind: 'clone'; fishAudioId: string; label: string };

type LoggedAvatarError = Error & {
  code?: string;
  status?: number;
  details?: { field?: string; msg?: string }[];
  payload?: unknown;
};

function formatGenerationSeconds(value?: number | null) {
  if (!value || value <= 0) return null;
  return `${Math.round(value / 1000)}s`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusMessageForAvatarJob(status?: AvatarJobStatus) {
  switch (status) {
    case 'script_ready':
      return 'Preparing your avatar...';
    case 'audio_generated':
      return 'Voice is ready. Now creating your video...';
    case 'video_generating':
      return 'Animating your avatar... almost there!';
    case 'completed':
      return 'Your avatar video is ready!';
    case 'failed':
      return 'Generation failed. Please try again.';
    default:
      return 'Creating your video... this can take 5 to 10 minutes.';
  }
}

type AvatarGenerationLoaderProps = {
  colors: ReturnType<typeof useAppTheme>['colors'];
  isDark: boolean;
  status?: AvatarJobStatus;
};

function AvatarGenerationLoader({ colors, isDark, status }: AvatarGenerationLoaderProps) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [activeIconIndex, setActiveIconIndex] = useState(0);
  const haloScale = useRef(new Animated.Value(0.92)).current;
  const haloOpacity = useRef(new Animated.Value(0.22)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const coreScale = useRef(new Animated.Value(0.98)).current;
  const coreGlow = useRef(new Animated.Value(0.82)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const dotValues = useRef([
    new Animated.Value(0.45),
    new Animated.Value(0.45),
    new Animated.Value(0.45),
  ]).current;
  const loaderIcons = useRef<React.ComponentProps<typeof Ionicons>['name'][]>([
    'mic',
    'videocam',
    'person',
  ]).current;

  useEffect(() => {
    let mounted = true;

    const syncReduceMotionPreference = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setReduceMotionEnabled(enabled);
      } catch {
        if (mounted) setReduceMotionEnabled(false);
      }
    };

    void syncReduceMotionPreference();

    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      haloScale.setValue(1);
      haloOpacity.setValue(0.24);
      ringRotation.setValue(0);
      coreScale.setValue(1);
      coreGlow.setValue(1);
      iconOpacity.setValue(1);
      dotValues.forEach((dot) => dot.setValue(0.75));
      return;
    }

    const haloLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(haloScale, {
            toValue: 1.1,
            duration: 1400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(haloScale, {
            toValue: 0.92,
            duration: 1400,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(haloOpacity, {
            toValue: 0.36,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.18,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const rotationLoop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const coreLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(coreScale, {
            toValue: 1.04,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(coreScale, {
            toValue: 0.98,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(coreGlow, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(coreGlow, {
            toValue: 0.82,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const dotLoops = dotValues.map((dot, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(dot, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.4,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ]),
      )
    ));

    haloLoop.start();
    rotationLoop.start();
    coreLoop.start();
    dotLoops.forEach((loop) => loop.start());

    return () => {
      haloLoop.stop();
      rotationLoop.stop();
      coreLoop.stop();
      dotLoops.forEach((loop) => loop.stop());
    };
  }, [coreGlow, coreScale, dotValues, haloOpacity, haloScale, iconOpacity, reduceMotionEnabled, ringRotation]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(iconOpacity, {
          toValue: 0.28,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      setActiveIconIndex((current) => (current + 1) % loaderIcons.length);
    }, reduceMotionEnabled ? 2200 : 1200);

    return () => {
      clearInterval(interval);
    };
  }, [iconOpacity, loaderIcons.length, reduceMotionEnabled]);

  const rotation = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="items-center">
      <View
        className="items-center justify-center"
        style={{ width: 140, height: 140 }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 132,
            height: 132,
            borderRadius: 66,
            backgroundColor: colors.primary,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 124,
            height: 124,
            borderRadius: 62,
            borderWidth: 1.5,
            borderColor: `${colors.primary}66`,
            borderTopColor: colors.primary,
            borderRightColor: `${colors.primary}AA`,
            transform: [{ rotate: rotation }],
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: isDark ? '#121A28' : '#FFFFFF',
            borderWidth: 1,
            borderColor: `${colors.primary}33`,
            opacity: coreGlow,
            transform: [{ scale: coreScale }],
          }}
        />
        <Animated.View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: isDark ? 0.45 : 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
            transform: [{ scale: coreScale }],
          }}
        >
          <Animated.View style={{ opacity: iconOpacity }}>
            <Ionicons name={loaderIcons[activeIconIndex] ?? 'videocam'} size={30} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>
      </View>

      <View className="mt-4 flex-row items-center justify-center">
        {dotValues.map((dot, index) => (
          <Animated.View
            key={`avatar-loader-dot-${index}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              marginHorizontal: 4,
              backgroundColor: colors.primary,
              opacity: dot,
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0, -5],
                  }),
                },
                {
                  scale: dot.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0.92, 1.08],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>

      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, letterSpacing: 0.6 }}>
        {status === 'video_generating' ? 'Rendering frames' : status === 'audio_generated' ? 'Syncing voice' : 'Preparing your avatar'}
      </Text>
    </View>
  );
}

function logAvatarUiError(scope: string, error: unknown) {
  if (!__DEV__) return;
  const typed = error as LoggedAvatarError | undefined;
  console.log(`[avatar-ui:error:${scope}]`, {
    message: typed?.message ?? (error instanceof Error ? error.message : String(error)),
    code: typed?.code,
    status: typed?.status,
    details: typed?.details,
    payload: typed?.payload,
    raw: error,
  });
}

function logAvatarUiState(label: string, payload: unknown) {
  if (!__DEV__) return;
  console.log(label, payload);
}

function pickRandomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function normalizeGalleryGender(value?: string | null): AvatarGalleryGender | '' {
  return value === 'female' || value === 'male' || value === 'neutral' ? value : '';
}

function normalizeGalleryStyle(value?: string | null): AvatarGalleryStyle | '' {
  return value === 'professional' || value === 'casual' || value === 'creative' ? value : '';
}

function normalizeVoiceGender(value?: string | null): '' | 'male' | 'female' {
  return value === 'female' || value === 'male' ? value : '';
}

function normalizeVoiceCategory(value?: string | null): '' | AvatarVoiceCategory {
  return value === 'professional' || value === 'african' || value === 'creative' || value === 'entertainment' ? value : '';
}

function estimateScriptDurationSeconds(script: string) {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  if (!wordCount) return null;
  return Math.min(15, Math.max(10, Math.round(wordCount / 2.6)));
}

function SectionCard({
  title,
  subtitle,
  children,
  colors,
  isDark,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: { border: string; textPrimary: string; textSecondary: string; primary: string };
  isDark: boolean;
}) {
  return (
    <View
      className="mb-4 rounded-[28px] border p-4"
      style={{
        borderColor: colors.border,
        backgroundColor: isDark ? '#0F1015' : '#FFFFFF',
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {subtitle}
        </Text>
      ) : null}
      <View style={{ marginTop: 14 }}>
        {children}
      </View>
    </View>
  );
}

function SelectionModal({
  visible,
  title,
  subtitle,
  onClose,
  colors,
  isDark,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  colors: { border: string; textPrimary: string; textSecondary: string; primary: string };
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(5, 8, 14, 0.78)' : 'rgba(15, 23, 42, 0.32)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          accessibilityHint="Closes this picker and returns to the avatar screen."
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '86%',
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
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
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
          </View>

          <ScrollView
            accessible
            accessibilityLabel={`${title} picker`}
            accessibilityHint="Browse the available options and choose the one you want to use."
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  colors,
  isDark,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: { border: string; primary: string; textPrimary: string };
  isDark: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="mr-2 mb-2 rounded-full px-3 py-2"
      style={{
        borderWidth: 1.2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}18` : (isDark ? '#11131A' : '#F8FAFC'),
      }}
    >
      <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AvatarVideoScreen() {
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const sectionContentWidth = useMemo(() => width - 52, [width]);
  const avatarCardWidth = useMemo(() => Math.floor((sectionContentWidth - 12) / 2), [sectionContentWidth]);
  const resultVideoWidth = useMemo(() => sectionContentWidth, [sectionContentWidth]);
  const historyVideoWidth = useMemo(() => sectionContentWidth - 32, [sectionContentWidth]);

  const [galleryGender, setGalleryGender] = useState<AvatarGalleryGender | ''>('');
  const [galleryStyle, setGalleryStyle] = useState<AvatarGalleryStyle | ''>('');
  const [gallery, setGallery] = useState<AvatarGalleryItem[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [selectedGalleryAvatarId, setSelectedGalleryAvatarId] = useState<string | null>(null);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [uploadedAvatar, setUploadedAvatar] = useState<UploadedAvatar | null>(null);
  const [selectedAvatarType, setSelectedAvatarType] = useState<'gallery' | 'upload'>('gallery');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [voices, setVoices] = useState<AvatarVoiceOption[]>([]);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'' | 'male' | 'female'>('');
  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState<'' | AvatarVoiceCategory>('');
  const [popularOnly, setPopularOnly] = useState(false);
  const [clonedVoices, setClonedVoices] = useState<AvatarClonedVoice[]>([]);
  const [isClonesLoading, setIsClonesLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SelectedAvatarVoice | null>(null);
  const [isLibraryVoicePickerOpen, setIsLibraryVoicePickerOpen] = useState(false);
  const [isClonedVoicePickerOpen, setIsClonedVoicePickerOpen] = useState(false);
  const [isVoicesLoading, setIsVoicesLoading] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [isSaveVoiceExpanded, setIsSaveVoiceExpanded] = useState(false);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);

  const [userGoal, setUserGoal] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState<AvatarScriptTone>('friendly');
  const [durationSeconds] = useState<AvatarDurationSeconds>(FIXED_DURATION_SECONDS);
  const [useCaseTemplate, setUseCaseTemplate] = useState<AvatarUseCaseTemplate>('product ad');
  const [scriptText, setScriptText] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptKeyPoints, setScriptKeyPoints] = useState<string[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isRandomizingSetup, setIsRandomizingSetup] = useState(false);

  const [activeJobMeta, setActiveJobMeta] = useState<PendingAvatarVideoJob | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<AvatarVideoStatus | null>(null);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
  const [currentResult, setCurrentResult] = useState<CurrentAvatarResult | null>(null);
  const [failedResult, setFailedResult] = useState<FailedAvatarResult | null>(null);
  const [isFailureModalVisible, setIsFailureModalVisible] = useState(false);

  const [history, setHistory] = useState<AvatarHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const [statusNotice, setStatusNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDownloadingCurrent, setIsDownloadingCurrent] = useState(false);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<string | null>(null);
  const [isSharingCurrent, setIsSharingCurrent] = useState(false);
  const [sharingHistoryId, setSharingHistoryId] = useState<string | null>(null);

  const mainScrollRef = useRef<ScrollView | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerSubRef = useRef<{ remove: () => void } | null>(null);
  const previewFileByVoiceIdRef = useRef<Record<string, File>>({});
  const previewUriByVoiceIdRef = useRef<Record<string, string>>({});
  const isMountedRef = useRef(true);
  const lastLoggedJobStatusRef = useRef<Record<string, string>>({});

  const selectedGalleryAvatar = useMemo(
    () => gallery.find((entry) => entry.id === selectedGalleryAvatarId) ?? null,
    [gallery, selectedGalleryAvatarId],
  );

  const selectedAvatarImageUrl = selectedAvatarType === 'upload'
    ? uploadedAvatar?.imageUrl ?? null
    : selectedGalleryAvatar?.imageUrl ?? null;

  const selectedGalleryAvatarName = selectedGalleryAvatar?.name?.trim() || 'No avatar selected yet';
  const canGenerateScript = userGoal.trim().length > 0 && Boolean(selectedAvatarImageUrl);
  const canGenerateVideo = Boolean(selectedAvatarImageUrl) && userGoal.trim().length > 0 && scriptText.trim().length > 0 && Boolean(selectedVoice) && !activeJobMeta;

  useEffect(() => {
    if (!errorMessage) return;
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [errorMessage]);

  const stopPreview = useCallback(() => {
    playerSubRef.current?.remove();
    playerSubRef.current = null;
    playerRef.current?.pause();
    playerRef.current?.remove();
    playerRef.current = null;
    setPreviewState('idle');
    setPreviewVoiceId(null);
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
    stopPreview();
    Object.values(previewFileByVoiceIdRef.current).forEach((file) => {
      try {
        if (file.exists) file.delete();
      } catch {
        // Ignore cache cleanup errors.
      }
    });
  }, [stopPreview]);

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  const loadGallery = useCallback(async () => {
    setIsGalleryLoading(true);
    try {
      const avatars = await getAvatarGallery({
        gender: galleryGender,
        style: galleryStyle,
        limit: 20,
      });
      if (!isMountedRef.current) return;
      setGallery(avatars);
      setErrorMessage('');
      if (selectedGalleryAvatarId && !avatars.some((entry) => entry.id === selectedGalleryAvatarId)) {
        setSelectedGalleryAvatarId(avatars[0]?.id ?? null);
      }
      if (!selectedGalleryAvatarId && avatars[0]?.id) {
        setSelectedGalleryAvatarId(avatars[0].id);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not load avatar gallery right now.');
    } finally {
      if (isMountedRef.current) setIsGalleryLoading(false);
    }
  }, [galleryGender, galleryStyle, selectedGalleryAvatarId]);

  const loadVoices = useCallback(async () => {
    setIsVoicesLoading(true);
    try {
      const catalog = await getAvatarVoiceCatalog({
        gender: voiceGenderFilter,
        category: voiceCategoryFilter,
        popular: popularOnly || undefined,
      });
      if (!isMountedRef.current) return;
      const nextVoices = catalog.voices ?? [];
      setVoices(nextVoices);
      const fallback = nextVoices[0];
      setSelectedVoice((current) => {
        if (current?.kind === 'clone') return current;
        if (current?.kind === 'library' && nextVoices.some((entry) => entry.id === current.voiceId)) return current;
        if (!fallback?.id) return null;
        return {
          kind: 'library',
          voiceId: fallback.id,
          label: fallback.name,
        };
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not load voices right now.');
    } finally {
      if (isMountedRef.current) setIsVoicesLoading(false);
    }
  }, [popularOnly, voiceCategoryFilter, voiceGenderFilter]);

  const loadClonedVoices = useCallback(async () => {
    setIsClonesLoading(true);
    try {
      const nextClones = await getAvatarVoiceClones();
      if (!isMountedRef.current) return;
      setClonedVoices(nextClones);
      setSelectedVoice((current) => {
        if (current?.kind === 'clone' && nextClones.some((entry) => entry.fishAudioId === current.fishAudioId)) {
          return current;
        }
        return current?.kind === 'clone' ? null : current;
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not load your saved voices right now.');
    } finally {
      if (isMountedRef.current) setIsClonesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (options?: { refreshing?: boolean }) => {
    if (options?.refreshing) {
      setIsHistoryRefreshing(true);
    } else {
      setIsHistoryLoading(true);
    }
    try {
      const page = await getAvatarHistory(1, HISTORY_LIMIT, { forceRefresh: options?.refreshing });
      if (!isMountedRef.current) return;
      setHistory(page.videos.filter((entry) => entry.status === 'completed'));
      setHasLoadedHistory(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not load avatar history right now.');
    } finally {
      if (!isMountedRef.current) return;
      setIsHistoryLoading(false);
      setIsHistoryRefreshing(false);
    }
  }, []);

  const openAvatarPicker = useCallback(() => {
    setIsAvatarPickerOpen(true);
    void loadGallery();
  }, [loadGallery]);

  const openLibraryVoicePicker = useCallback(() => {
    setIsLibraryVoicePickerOpen(true);
    void loadVoices();
  }, [loadVoices]);

  const openClonedVoicePicker = useCallback(() => {
    setIsClonedVoicePickerOpen(true);
    void loadClonedVoices();
  }, [loadClonedVoices]);

  useEffect(() => {
    void (async () => {
      const pending = await getPendingAvatarVideoJob();
      if (!isMountedRef.current || !pending) return;
      setActiveJobMeta(pending);
      setStatusNotice(statusMessageForAvatarJob('processing'));
    })();
  }, []);

  useEffect(() => {
    if (!isAvatarPickerOpen) return;
    void loadGallery();
  }, [isAvatarPickerOpen, loadGallery]);

  useEffect(() => {
    if (!isLibraryVoicePickerOpen) return;
    void loadVoices();
  }, [isLibraryVoicePickerOpen, loadVoices]);

  useEffect(() => {
    if (!isClonedVoicePickerOpen) return;
    void loadClonedVoices();
  }, [isClonedVoicePickerOpen, loadClonedVoices]);

  useEffect(() => {
    if (!activeJobMeta) return;
    if (activeJobStatus?.status === 'completed' || activeJobStatus?.status === 'failed') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const status = await getAvatarVideoStatus(activeJobMeta.jobId);
        if (cancelled || !isMountedRef.current) return;
        setActiveJobStatus(status);
        if (__DEV__) {
          const lastStatus = lastLoggedJobStatusRef.current[activeJobMeta.jobId];
          if (lastStatus !== status.status) {
            lastLoggedJobStatusRef.current[activeJobMeta.jobId] = status.status;
            console.log('[avatar-job:status-change]', {
              jobId: activeJobMeta.jobId,
              previousStatus: lastStatus ?? null,
              status: status.status,
              hasVideoUrl: Boolean(status.videoUrl),
              hasAudioUrl: Boolean(status.audioUrl),
            });
          }
        }
        const nextNotice = statusMessageForAvatarJob(status.status);
        setStatusNotice(nextNotice);
        announce(nextNotice);

        if (status.status === 'completed') {
          await clearPendingAvatarVideoJob();
          if (cancelled || !isMountedRef.current) return;
          setCurrentResult({ status, meta: activeJobMeta });
          setActiveJobMeta(null);
          setErrorMessage('');
          setStatusNotice('Your avatar video is ready!');
          hapticSuccess();
          void loadHistory({ refreshing: true });
          return;
        }

        if (status.status === 'failed') {
          await clearPendingAvatarVideoJob();
          if (cancelled || !isMountedRef.current) return;
          setStatusNotice('');
          setErrorMessage('We could not finish this video. Please try again with a different avatar, voice, or script.');
          setFailedResult({ status, meta: activeJobMeta });
          setIsFailureModalVisible(true);
          setActiveJobMeta(null);
          setActiveJobStatus(status);
          hapticError();
          return;
        }

        timer = setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled || !isMountedRef.current) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not check avatar generation status right now.');
        timer = setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobMeta, activeJobStatus?.status, announce, loadHistory]);

  const uploadOwnPhoto = useCallback(async () => {
    try {
      setIsUploadingAvatar(true);
      setErrorMessage('');
      const picked = await pickSingleImageFromLibrary(ExpoImagePicker, { allowsEditing: true, quality: 0.9, aspect: [4, 5] });
      if (!picked) return;

      const mimeType = picked.mimeType?.trim().toLowerCase() || 'image/jpeg';
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
        throw new Error('Please choose a JPG, PNG, or WEBP portrait photo.');
      }
      if (picked.uri.startsWith('file://')) {
        const info = await LegacyFileSystem.getInfoAsync(picked.uri);
        if (!info.exists) {
          throw new Error('The selected photo is no longer available on this device.');
        }
        if (typeof info.size === 'number' && info.size > MAX_UPLOAD_BYTES) {
          throw new Error('Please choose a photo that is 10MB or smaller.');
        }
      }

      const imageUrl = await uploadAvatarImage({
        uri: picked.uri,
        fileName: picked.fileName ?? `avatar-${Date.now()}.jpg`,
        mimeType,
      });
      if (!isMountedRef.current) return;
      setUploadedAvatar({
        imageUrl,
        localUri: picked.uri,
        fileName: picked.fileName,
        mimeType,
      });
      setSelectedAvatarType('upload');
      setStatusNotice('Your custom avatar photo is ready to use.');
      announce('Custom avatar photo uploaded successfully.');
      hapticSuccess();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('upload-photo', error);
      const message = error instanceof Error ? error.message : 'Could not upload that photo right now.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (isMountedRef.current) setIsUploadingAvatar(false);
    }
  }, [announce]);

  const randomizeSetup = useCallback(async () => {
    if (isRandomizingSetup || isStartingGeneration || activeJobMeta) return;

    setIsRandomizingSetup(true);
    setErrorMessage('');
    setStatusNotice('Picking a ready-to-use setup for you...');
    stopPreview();

    try {
      const [avatars, voiceCatalog] = await Promise.all([
        getAvatarGallery({ limit: 20 }),
        getAvatarVoiceCatalog({}),
      ]);

      if (!isMountedRef.current) return;

      const randomAvatar = pickRandomItem(avatars);
      const randomVoice = pickRandomItem(voiceCatalog.voices ?? []);
      const randomPreset = pickRandomAvatarScriptPreset();

      if (!randomAvatar) {
        throw new Error('No avatars are available right now.');
      }

      if (!randomVoice) {
        throw new Error('No built-in voices are available right now.');
      }

      setGallery(avatars);
      setVoices(voiceCatalog.voices ?? []);
      setGalleryGender(normalizeGalleryGender(randomAvatar.gender));
      setGalleryStyle(normalizeGalleryStyle(randomAvatar.style));
      setVoiceGenderFilter(normalizeVoiceGender(randomVoice.gender));
      setVoiceCategoryFilter(normalizeVoiceCategory(randomVoice.category));
      setPopularOnly(Boolean(randomVoice.popular));
      setSelectedAvatarType('gallery');
      setSelectedGalleryAvatarId(randomAvatar.id);
      setSelectedVoice({
        kind: 'library',
        voiceId: randomVoice.id,
        label: randomVoice.name,
      });
      setUserGoal(randomPreset.userGoal);
      setTargetAudience(randomPreset.targetAudience);
      setTone(randomPreset.tone);
      setUseCaseTemplate(randomPreset.useCaseTemplate);
      setScriptText(randomPreset.scriptText);
      setScriptTitle(randomPreset.title);
      setScriptKeyPoints(randomPreset.keyPoints);
      setEstimatedDuration(estimateScriptDurationSeconds(randomPreset.scriptText));
      setStatusNotice(`Ready to generate: ${randomPreset.title}.`);
      announce('A complete avatar setup is ready. You can generate your video now.');
      logAvatarUiState('[avatar-ui:randomized-setup]', {
        presetTitle: randomPreset.title,
        topic: randomPreset.topic,
        avatarId: randomAvatar.id,
        avatarName: randomAvatar.name,
        voiceId: randomVoice.id,
        voiceName: randomVoice.name,
        tone: randomPreset.tone,
        useCaseTemplate: randomPreset.useCaseTemplate,
      });
      hapticSuccess();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('randomize-setup', error);
      const message = error instanceof Error ? error.message : 'Could not build a random setup right now.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (isMountedRef.current) setIsRandomizingSetup(false);
    }
  }, [activeJobMeta, announce, isRandomizingSetup, isStartingGeneration, stopPreview]);

  const generateScript = useCallback(async () => {
    if (!canGenerateScript || isGeneratingScript) return;
    setIsGeneratingScript(true);
    setErrorMessage('');
    setStatusNotice('Writing your script...');
    try {
      const result = await generateAvatarScript({
        userGoal: userGoal.trim(),
        targetAudience: targetAudience.trim() || undefined,
        tone,
        durationSeconds,
        useCaseTemplate,
      });
      if (!isMountedRef.current) return;
      setScriptText(result.script);
      setScriptTitle(result.title?.trim() || '');
      setScriptKeyPoints(result.keyPoints ?? []);
      setEstimatedDuration(result.estimatedDurationSeconds ?? null);
      setStatusNotice('Script ready. Review it and make any edits you want.');
      announce('Script generated successfully.');
      hapticSuccess();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('generate-script', error);
      const message = error instanceof Error ? error.message : 'Could not generate a script right now.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (isMountedRef.current) setIsGeneratingScript(false);
    }
  }, [announce, canGenerateScript, durationSeconds, isGeneratingScript, targetAudience, tone, useCaseTemplate, userGoal]);

  const previewVoice = useCallback(async (payload: { cacheKey: string; voiceId?: string; fishAudioId?: string }) => {
    if (previewVoiceId === payload.cacheKey && previewState === 'playing') {
      stopPreview();
      return;
    }
    stopPreview();
    setErrorMessage('');
    setPreviewVoiceId(payload.cacheKey);

    try {
      let uri = previewUriByVoiceIdRef.current[payload.cacheKey];
      if (!uri) {
        setPreviewState('loading');
        const bytes = await previewAvatarVoice({
          voiceId: payload.voiceId,
          fishAudioId: payload.fishAudioId,
        });
        const file = new File(Paths.cache, `avatar-voice-preview-${payload.cacheKey}.mp3`);
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);
        previewFileByVoiceIdRef.current[payload.cacheKey] = file;
        uri = file.uri;
        previewUriByVoiceIdRef.current[payload.cacheKey] = uri;
      }

      const { createAudioPlayer } = await getExpoAudioModule();
      const player = createAudioPlayer(uri, { keepAudioSessionActive: true });
      playerRef.current = player;
      setPreviewState('playing');
      playerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopPreview();
        }
      });
      player.play();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('preview-voice', error);
      stopPreview();
      setPreviewState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Voice preview failed.');
      hapticError();
    }
  }, [previewState, previewVoiceId, stopPreview]);

  const cloneVoice = useCallback(async (recording: { uri: string; fileName: string; mimeType: string }) => {
    setIsCloningVoice(true);
    setIsVoiceRecorderOpen(false);
    setErrorMessage('');
    setStatusNotice('Cloning your voice...');
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
      await loadClonedVoices();
      setSelectedVoice({
        kind: 'clone',
        fishAudioId: clone.fishAudioId,
        label: clone.name,
      });
      setCloneVoiceName('');
      setStatusNotice(clone.status === 'ready' ? 'Your saved voice is ready to use.' : 'Your voice sample is being prepared. It should be ready soon.');
      announce('Voice cloning completed successfully.');
      hapticSuccess();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('clone-voice', error);
      const message = error instanceof Error ? error.message : 'Could not clone your voice right now.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (isMountedRef.current) setIsCloningVoice(false);
    }
  }, [announce, cloneVoiceName, loadClonedVoices]);

  const startGeneration = useCallback(async () => {
    logAvatarUiState('[avatar-ui:start-generation:attempt]', {
      canGenerateVideo,
      isStartingGeneration,
      hasSelectedAvatarImageUrl: Boolean(selectedAvatarImageUrl),
      hasUserGoal: userGoal.trim().length > 0,
      hasScriptText: scriptText.trim().length > 0,
      selectedVoice,
      activeJobMeta,
    });

    if (!canGenerateVideo || isStartingGeneration || !selectedAvatarImageUrl) {
      logAvatarUiState('[avatar-ui:start-generation:blocked]', {
        reason: {
          canGenerateVideo,
          isStartingGeneration,
          hasSelectedAvatarImageUrl: Boolean(selectedAvatarImageUrl),
        },
      });
      return;
    }

    const pendingMeta: PendingAvatarVideoJob = {
      jobId: '',
      avatarImageUrl: selectedAvatarImageUrl,
      avatarType: selectedAvatarType,
      galleryAvatarId: selectedAvatarType === 'gallery' ? selectedGalleryAvatarId : null,
      scriptText: scriptText.trim(),
      userGoal: userGoal.trim(),
      voiceName: selectedVoice?.kind === 'library' ? selectedVoice.voiceId : undefined,
      fishAudioId: selectedVoice?.kind === 'clone' ? selectedVoice.fishAudioId : undefined,
      voiceLabel: selectedVoice?.label ?? '',
      useCaseTemplate,
      createdAt: new Date().toISOString(),
    };

    setIsStartingGeneration(true);
    setErrorMessage('');
    setStatusNotice('Submitting your avatar video job...');
    try {
      logAvatarUiState('[avatar-ui:start-generation:payload]', pendingMeta);
      const job = await generateAvatarVideo({
        avatarImageUrl: pendingMeta.avatarImageUrl,
        avatarType: pendingMeta.avatarType,
        galleryAvatarId: pendingMeta.galleryAvatarId ?? undefined,
        scriptText: pendingMeta.scriptText,
        userGoal: pendingMeta.userGoal,
        voiceName: pendingMeta.voiceName,
        fishAudioId: pendingMeta.fishAudioId,
        useCaseTemplate: pendingMeta.useCaseTemplate,
      });
      const nextMeta = { ...pendingMeta, jobId: job.id };
      await setPendingAvatarVideoJob(nextMeta);
      if (!isMountedRef.current) return;
      setActiveJobMeta(nextMeta);
      setActiveJobStatus({
        id: job.id,
        status: job.status,
        scriptText: pendingMeta.scriptText,
        createdAt: pendingMeta.createdAt,
      });
      setCurrentResult(null);
      setStatusNotice(statusMessageForAvatarJob(job.status));
      announce('Avatar video generation started.');
      hapticSuccess();
    } catch (error) {
      if (!isMountedRef.current) return;
      logAvatarUiError('start-generation', error);
      const message = error instanceof Error ? error.message : 'Could not start avatar generation.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (isMountedRef.current) setIsStartingGeneration(false);
    }
  }, [
    activeJobMeta,
    announce,
    canGenerateVideo,
    isStartingGeneration,
    scriptText,
    selectedVoice,
    selectedAvatarImageUrl,
    selectedAvatarType,
    selectedGalleryAvatarId,
    useCaseTemplate,
    userGoal,
  ]);

  const cancelGeneration = useCallback(() => {
    if (!activeJobMeta || isCancellingGeneration) return;
    Alert.alert(
      'Cancel avatar video?',
      'The current generation will stop and cannot be resumed.',
      [
        { text: 'Keep Generating', style: 'cancel' },
        {
          text: 'Cancel Generation',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsCancellingGeneration(true);
              try {
                await cancelAvatarVideo(activeJobMeta.jobId);
                await clearPendingAvatarVideoJob();
                if (!isMountedRef.current) return;
                setActiveJobMeta(null);
                setActiveJobStatus(null);
                setStatusNotice('Avatar video generation cancelled.');
                announce('Avatar video generation cancelled.');
              } catch (error) {
                if (!isMountedRef.current) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not cancel avatar generation.');
              } finally {
                if (isMountedRef.current) setIsCancellingGeneration(false);
              }
            })();
          },
        },
      ],
    );
  }, [activeJobMeta, announce, isCancellingGeneration]);

  const downloadVideoToDevice = useCallback(async (videoUrl: string, fileStem: string, historyId?: string) => {
    if (historyId) {
      setDownloadingHistoryId(historyId);
    } else {
      setIsDownloadingCurrent(true);
    }

    try {
      const safeStem = fileStem.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || `avatar-${Date.now()}`;
      const target = new File(Paths.cache, `${safeStem}.mp4`);
      target.create({ intermediates: true, overwrite: true });
      const downloaded = await File.downloadFileAsync(videoUrl, target, { idempotent: true });
      await saveMediaToCafaAlbum(downloaded.uri);
      setStatusNotice('Avatar video saved to your device.');
      announce('Avatar video saved successfully.');
      hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the avatar video.';
      if (
        Platform.OS === 'ios'
        && (error as { code?: string } | undefined)?.code === IOS_PHOTO_PERMISSION_DENIED_CODE
      ) {
        Alert.alert(
          'Photos Permission Needed',
          'Allow Photos access in Settings to save avatar videos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (historyId) {
        setDownloadingHistoryId(null);
      } else {
        setIsDownloadingCurrent(false);
      }
    }
  }, [announce]);

  const shareVideo = useCallback(async (videoUrl: string, fileStem: string, historyId?: string) => {
    if (historyId) {
      setSharingHistoryId(historyId);
    } else {
      setIsSharingCurrent(true);
    }
    try {
      const safeStem = fileStem.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || `avatar-share-${Date.now()}`;
      setStatusNotice('Preparing your video for sharing...');
      announce('Preparing your video for sharing.');
      const target = new File(Paths.cache, `${safeStem}.mp4`);
      target.create({ intermediates: true, overwrite: true });
      const downloaded = await File.downloadFileAsync(videoUrl, target, { idempotent: true });
      await Share.share({
        url: downloaded.uri,
        message: 'Avatar video',
      });
      setStatusNotice('');
      announce('Share sheet opened.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not share this avatar video.';
      setErrorMessage(message);
      setStatusNotice('');
      announce(message);
      hapticError();
    } finally {
      if (historyId) {
        setSharingHistoryId(null);
      } else {
        setIsSharingCurrent(false);
      }
    }
  }, [announce]);

  const resetComposer = useCallback(() => {
    setCurrentResult(null);
    setFailedResult(null);
    setIsFailureModalVisible(false);
    setActiveJobStatus(null);
    setStatusNotice('');
    setErrorMessage('');
    setScriptText('');
    setScriptTitle('');
    setScriptKeyPoints([]);
    setEstimatedDuration(null);
    announce('Ready to create another avatar video.');
  }, [announce]);

  return (
    <RequireAuthRoute>
      <AppScreen title="Avatar Video">
        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 18 }}
          refreshControl={(
            <RefreshControl
              refreshing={isHistoryRefreshing}
              onRefresh={() => { void loadHistory({ refreshing: true }); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={isDark ? '#0A0A0A' : '#FFFFFF'}
            />
          )}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            Create a talking avatar video by choosing a face, drafting your message, and matching it with the right voice.
          </Text>
          <View style={{ alignItems: 'flex-end', marginTop: -8, marginBottom: 16 }}>
            <AppButton
              label="History"
              iconName="time-outline"
              compact
              variant="outline"
              onPress={() => router.push('/(drawer)/avatar-history' as Href)}
            />
          </View>

          {statusNotice ? (
            <View
              accessibilityRole="alert"
              className="mb-4 rounded-2xl border px-4 py-3"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#0C1320' : '#F8FAFC',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                {statusNotice}
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View
              accessibilityRole="alert"
              className="mb-4 rounded-2xl border px-4 py-3"
              style={{
                borderColor: 'rgba(220,38,38,0.28)',
                backgroundColor: isDark ? 'rgba(88,18,18,0.35)' : '#FFF5F5',
              }}
            >
              <Text style={{ color: isDark ? '#FFD7D7' : '#B42318', fontSize: 13, fontWeight: '600' }}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Modal
            visible={isFailureModalVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setIsFailureModalVisible(false)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: 20,
                backgroundColor: isDark ? 'rgba(5, 8, 14, 0.78)' : 'rgba(15, 23, 42, 0.32)',
              }}
            >
              <View
                accessibilityViewIsModal
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: 'rgba(220,38,38,0.28)',
                  backgroundColor: isDark ? '#11151D' : '#FFFFFF',
                }}
              >
                <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                  We could not finish your video
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10 }}>
                  This attempt did not complete successfully. You can try again now, or close this message and adjust the avatar, voice, or script first.
                </Text>
                {failedResult ? (
                  <View
                    className="mt-4 rounded-[22px] border p-4"
                    style={{ borderColor: colors.border, backgroundColor: isDark ? '#0C0E13' : '#F8FAFC' }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Voice: {failedResult.meta.voiceLabel}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      Started: {formatDateLabel(failedResult.meta.createdAt)}
                    </Text>
                    {failedResult.status.createdAt ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                        Last update: {formatDateLabel(failedResult.status.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View className="mt-5">
                  <AppButton
                    label="Try Again"
                    iconName="refresh-outline"
                    compact
                    onPress={() => {
                      setIsFailureModalVisible(false);
                      void startGeneration();
                    }}
                  />
                  <View style={{ height: 12 }} />
                  <AppButton
                    label="Close"
                    iconName="close-outline"
                    compact
                    variant="outline"
                    onPress={() => setIsFailureModalVisible(false)}
                  />
                </View>
              </View>
            </View>
          </Modal>

          <SectionCard
            title="Quick start"
            subtitle="Want a ready-made setup? We can instantly choose an avatar, voice, topic, and full script for you."
            colors={colors}
            isDark={isDark}
          >
            <View
              className="rounded-[22px] border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                Randomize everything
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                We will pull from a large topic pool and set a gallery avatar, built-in voice, tone, use case, and ready-to-use script.
              </Text>
              <View style={{ marginTop: 14 }}>
                <AppButton
                  label={isRandomizingSetup ? 'Randomizing...' : 'Randomize Setup'}
                  iconName="shuffle-outline"
                  compact
                  onPress={() => {
                    if (!isRandomizingSetup) {
                      void randomizeSetup();
                    }
                  }}
                />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 10 }}>
                After that, all you need to do is tap Generate Video.
              </Text>
            </View>
          </SectionCard>

          <SectionCard
            title="1. Choose your avatar"
            subtitle="Pick from the gallery or upload a front-facing portrait photo for a custom talking avatar."
            colors={colors}
            isDark={isDark}
          >
            <View
              className="mb-2 rounded-[22px] border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                Current selection
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                {selectedAvatarType === 'upload'
                  ? 'Your uploaded portrait is selected.'
                  : selectedGalleryAvatarName}
              </Text>
              {selectedAvatarType === 'gallery' && selectedGalleryAvatar ? (
                <View className="mt-3 flex-row items-center">
                  <ExpoImage
                    source={{ uri: selectedGalleryAvatar.thumbnailUrl || selectedGalleryAvatar.imageUrl }}
                    style={{ width: 64, height: 80, borderRadius: 16, backgroundColor: isDark ? '#0C0E13' : '#FFFFFF' }}
                    contentFit="cover"
                    accessible
                    accessibilityLabel={`${selectedGalleryAvatar.name} selected avatar preview`}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      {selectedGalleryAvatar.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      {[selectedGalleryAvatar.gender, selectedGalleryAvatar.style, selectedGalleryAvatar.setting].filter(Boolean).join(' • ') || 'Gallery avatar'}
                    </Text>
                  </View>
                </View>
              ) : selectedAvatarType === 'upload' && uploadedAvatar ? (
                <View className="mt-3 flex-row items-center">
                  <ExpoImage
                    source={{ uri: uploadedAvatar.localUri || uploadedAvatar.imageUrl }}
                    style={{ width: 64, height: 80, borderRadius: 16, backgroundColor: isDark ? '#0C0E13' : '#FFFFFF' }}
                    contentFit="cover"
                    accessible
                    accessibilityLabel="Uploaded selected avatar preview"
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      Your uploaded photo
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      Custom avatar
                    </Text>
                  </View>
                </View>
              ) : null}
              <View className="mt-4">
                <AppButton
                  label="Choose Avatar"
                  iconName="images-outline"
                  compact
                  onPress={openAvatarPicker}
                />
                <View style={{ height: 12 }} />
                <AppButton
                  label={isUploadingAvatar ? 'Uploading...' : 'Upload Your Own Photo'}
                  iconName="cloud-upload-outline"
                  compact
                  variant="outline"
                  onPress={() => {
                    if (!isUploadingAvatar) {
                      void uploadOwnPhoto();
                    }
                  }}
                />
              </View>
            </View>

            <SelectionModal
              visible={isAvatarPickerOpen}
              title="Choose your avatar"
              subtitle="Browse the gallery and pick the look you want for your video."
              onClose={() => setIsAvatarPickerOpen(false)}
              colors={colors}
              isDark={isDark}
            >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              Filter gallery
            </Text>
            <View className="mb-2 flex-row flex-wrap">
              {GENDER_FILTERS.map((entry) => (
                <FilterChip
                  key={entry.label}
                  label={entry.label}
                  selected={galleryGender === entry.value}
                  onPress={() => setGalleryGender(entry.value)}
                  colors={colors}
                  isDark={isDark}
                  accessibilityLabel={`Filter avatars by gender: ${entry.label}`}
                />
              ))}
            </View>
            <View className="mb-3 flex-row flex-wrap">
              {STYLE_FILTERS.map((entry) => (
                <FilterChip
                  key={entry.label}
                  label={entry.label}
                  selected={galleryStyle === entry.value}
                  onPress={() => setGalleryStyle(entry.value)}
                  colors={colors}
                  isDark={isDark}
                  accessibilityLabel={`Filter avatars by style: ${entry.label}`}
                />
              ))}
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {isGalleryLoading ? 'Loading gallery...' : `${gallery.length} avatars available`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload your own portrait photo"
                accessibilityHint="Opens your photo library so you can upload a custom avatar image."
                onPress={() => { void uploadOwnPhoto(); }}
                className="rounded-full px-3 py-2"
                style={{
                  borderWidth: 1.2,
                  borderColor: colors.primary,
                  backgroundColor: `${colors.primary}12`,
                  opacity: isUploadingAvatar ? 0.7 : 1,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  {isUploadingAvatar ? 'Uploading...' : 'Upload your own photo'}
                </Text>
              </Pressable>
            </View>

            {uploadedAvatar ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use your uploaded avatar photo"
                accessibilityState={{ selected: selectedAvatarType === 'upload' }}
                onPress={() => setSelectedAvatarType('upload')}
                className="mb-4 rounded-[22px] border p-3"
                style={{
                  borderColor: selectedAvatarType === 'upload' ? colors.primary : colors.border,
                  backgroundColor: selectedAvatarType === 'upload' ? `${colors.primary}10` : (isDark ? '#12151D' : '#F8FAFC'),
                }}
              >
                <View className="flex-row items-center">
                  <ExpoImage
                    source={{ uri: uploadedAvatar.localUri || uploadedAvatar.imageUrl }}
                    style={{ width: 64, height: 80, borderRadius: 16, backgroundColor: isDark ? '#0C0E13' : '#FFFFFF' }}
                    contentFit="cover"
                    accessible
                    accessibilityLabel="Uploaded avatar preview"
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      Your uploaded photo
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      Best results come from a clear portrait or headshot with the face fully visible.
                    </Text>
                  </View>
                  {selectedAvatarType === 'upload' ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : null}
                </View>
              </Pressable>
            ) : null}

            {isGalleryLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {gallery.map((item) => {
                  const isSelected = selectedAvatarType === 'gallery' && selectedGalleryAvatarId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select avatar ${item.name}`}
                      accessibilityHint={`Chooses ${item.name} for your talking avatar video.`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setSelectedAvatarType('gallery');
                        setSelectedGalleryAvatarId(item.id);
                        setIsAvatarPickerOpen(false);
                      }}
                      className="mb-3 overflow-hidden rounded-[22px] border"
                      style={{
                        width: avatarCardWidth,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isDark ? '#12151D' : '#FFFFFF',
                      }}
                    >
                      <View>
                        <ExpoImage
                          source={{ uri: item.thumbnailUrl || item.imageUrl }}
                          style={{ width: '100%', height: avatarCardWidth * 1.18, backgroundColor: isDark ? '#0C0E13' : '#F8FAFC' }}
                          contentFit="cover"
                          accessible
                          accessibilityLabel={`${item.name} avatar preview`}
                        />
                        {isSelected ? (
                          <View
                            className="absolute right-3 top-3 rounded-full px-2 py-1"
                            style={{ backgroundColor: colors.primary }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Selected</Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="p-3">
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
                          {[item.gender, item.style, item.setting].filter(Boolean).join(' • ') || 'Gallery avatar'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            </SelectionModal>
          </SectionCard>

          <SectionCard
            title="2. Generate your script"
            subtitle="Describe what you want to say in plain language. We will draft it for you, and you can edit it before creating the video."
            colors={colors}
            isDark={isDark}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
              What should the avatar say?
            </Text>
            <TextInput
              value={userGoal}
              onChangeText={setUserGoal}
              multiline
              textAlignVertical="top"
              placeholder="Example: Promote my bakery called Sweet Treats in Accra Ghana."
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Avatar video goal"
              accessibilityHint="Describe what you want the avatar to say or promote."
              style={{
                minHeight: 110,
                marginTop: 8,
                borderWidth: 1.2,
                borderColor: colors.border,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.textPrimary,
                backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
              }}
            />

            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
              Target audience
            </Text>
            <TextInput
              value={targetAudience}
              onChangeText={setTargetAudience}
              placeholder="Optional: Who this video is for"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Target audience"
              accessibilityHint="Optional field describing who should receive this message."
              style={{
                marginTop: 8,
                borderWidth: 1.2,
                borderColor: colors.border,
                borderRadius: 18,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.textPrimary,
                backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
              }}
            />

            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
              Tone
            </Text>
            <View className="mt-2 flex-row flex-wrap">
              {TONE_OPTIONS.map((entry) => (
                <FilterChip
                  key={entry.value}
                  label={entry.label}
                  selected={tone === entry.value}
                  onPress={() => setTone(entry.value)}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              Use case
            </Text>
            <View className="mt-2 flex-row flex-wrap">
              {USE_CASE_OPTIONS.map((entry) => (
                <FilterChip
                  key={entry.value}
                  label={entry.label}
                  selected={useCaseTemplate === entry.value}
                  onPress={() => setUseCaseTemplate(entry.value)}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>

            <View className="mt-4 flex-row flex-wrap items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isGeneratingScript ? 'Generating script' : 'Generate script'}
                accessibilityHint="Uses your goal and settings to draft a talking avatar script."
                disabled={!canGenerateScript || isGeneratingScript}
                onPress={() => { void generateScript(); }}
                className="rounded-full px-4 py-3"
                style={{
                  backgroundColor: canGenerateScript && !isGeneratingScript ? colors.primary : `${colors.primary}66`,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {isGeneratingScript ? 'Generating...' : (scriptText.trim() ? 'Regenerate Script' : 'Generate Script')}
                </Text>
              </Pressable>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 10, marginTop: 8 }}>
                Best results stay under about 110 words.
              </Text>
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 16 }}>
              Editable script
            </Text>
            <TextInput
              value={scriptText}
              onChangeText={setScriptText}
              multiline
              textAlignVertical="top"
              placeholder="Your generated script will appear here."
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Editable avatar script"
              accessibilityHint="Review and edit the generated script before creating the avatar video."
              style={{
                minHeight: 160,
                marginTop: 8,
                borderWidth: 1.2,
                borderColor: colors.border,
                borderRadius: 22,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.textPrimary,
                backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
              }}
            />

            {scriptTitle || estimatedDuration || scriptKeyPoints.length ? (
              <View
                className="mt-4 rounded-[22px] border p-4"
                style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
              >
                {scriptTitle ? (
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                    {scriptTitle}
                  </Text>
                ) : null}
                {estimatedDuration ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                    Estimated duration: {estimatedDuration}s
                  </Text>
                ) : null}
                {scriptKeyPoints.length ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                      Key points
                    </Text>
                    {scriptKeyPoints.map((point) => (
                      <Text key={point} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                        • {point}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          <SectionCard
            title="3. Pick a voice"
            subtitle="Choose from built-in voices or from voice samples you have already saved."
            colors={colors}
            isDark={isDark}
          >
            <View
              className="mb-4 rounded-[22px] border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                Current selection
              </Text>
              {selectedVoice?.kind === 'library' ? (
                <View
                  className="mt-3 flex-row items-center"
                  accessible
                  accessibilityLabel={`Built-in voice selected: ${selectedVoice.label}`}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, backgroundColor: `${colors.primary}18` }}
                  >
                    <Ionicons name="mic" size={21} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                      Built-in voice
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                      {selectedVoice.label}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                  {selectedVoice?.kind === 'clone' ? `Saved voice: ${selectedVoice.label}` : 'No voice selected yet'}
                </Text>
              )}
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                {isVoicesLoading ? 'Loading voice options...' : `${voices.length} built-in voices available`} · {isClonesLoading ? 'Loading saved voices...' : `${clonedVoices.length} saved voices available`}
              </Text>
              <View className="mt-4">
                <AppButton
                  label="Choose Library Voice"
                  iconName="volume-high-outline"
                  compact
                  onPress={openLibraryVoicePicker}
                />
                <View style={{ height: 12 }} />
                <AppButton
                  label="Choose Saved Voice"
                  iconName="person-circle-outline"
                  compact
                  variant="outline"
                  onPress={openClonedVoicePicker}
                />
              </View>
            </View>

            <SelectionModal
              visible={isLibraryVoicePickerOpen}
              title="Choose a built-in voice"
              subtitle="Filter the available voices, preview them, and pick the one that fits best."
              onClose={() => setIsLibraryVoicePickerOpen(false)}
              colors={colors}
              isDark={isDark}
            >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
              Filter voices
            </Text>
            <View className="mt-2 flex-row flex-wrap">
              {VOICE_GENDER_FILTERS.map((entry) => (
                <FilterChip
                  key={entry.label}
                  label={entry.label}
                  selected={voiceGenderFilter === entry.value}
                  onPress={() => setVoiceGenderFilter(entry.value)}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>
            <View className="mt-1 flex-row flex-wrap">
              {VOICE_CATEGORY_FILTERS.map((entry) => (
                <FilterChip
                  key={entry.label}
                  label={entry.label}
                  selected={voiceCategoryFilter === entry.value}
                  onPress={() => setVoiceCategoryFilter(entry.value)}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>
            <View className="mt-1 flex-row">
              <FilterChip
                label="Popular only"
                selected={popularOnly}
                onPress={() => setPopularOnly((current) => !current)}
                colors={colors}
                isDark={isDark}
              />
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 10 }}>
              Voice options
            </Text>
            {isVoicesLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : voices.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                No voices matched these filters.
              </Text>
            ) : (
              voices.map((voice) => {
                const isSelected = selectedVoice?.kind === 'library' && selectedVoice.voiceId === voice.id;
                const previewCacheKey = `library:${voice.id}`;
                const isTargetPreview = previewVoiceId === previewCacheKey;
                const isLoadingPreview = isTargetPreview && previewState === 'loading';
                const isPlaying = isTargetPreview && previewState === 'playing';

                return (
                  <View
                    key={voice.id}
                    className="mb-3 rounded-[22px] border p-4"
                    style={{
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}10` : (isDark ? '#11151D' : '#FFFFFF'),
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                          {voice.name}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                          {[voice.gender, voice.category, voice.description].filter(Boolean).join(' • ') || 'Avatar voice'}
                        </Text>
                      </View>
                      {voice.popular ? (
                      <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${colors.primary}12` }}>
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                            Popular
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="mt-3 flex-row flex-wrap items-center">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? `Stop ${voice.name} preview` : `Preview ${voice.name} voice`}
                        accessibilityHint="Plays a short sample so you can hear this voice before selecting it."
                        onPress={() => {
                          void previewVoice({ cacheKey: previewCacheKey, voiceId: voice.id });
                        }}
                        className="rounded-full px-3 py-2"
                        style={{
                          borderWidth: 1.2,
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                          {isLoadingPreview ? 'Loading...' : isPlaying ? 'Stop Preview' : 'Preview Voice'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={`Select voice ${voice.name}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          setSelectedVoice({ kind: 'library', voiceId: voice.id, label: voice.name });
                          setIsLibraryVoicePickerOpen(false);
                        }}
                        className="ml-2 rounded-full px-3 py-2"
                        style={{
                          borderWidth: 1.2,
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? `${colors.primary}14` : (isDark ? '#0C0E13' : '#FFFFFF'),
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                          {isSelected ? 'Selected' : 'Use This Voice'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            </SelectionModal>

            <View className="mt-4 rounded-[22px] border" style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSaveVoiceExpanded ? 'Collapse save my voice section' : 'Expand save my voice section'}
                accessibilityHint="Shows or hides the form used to save your own voice sample."
                onPress={() => setIsSaveVoiceExpanded((current) => !current)}
                className="flex-row items-center justify-between px-4 py-4"
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                    Save my voice
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                    Upload a short voice sample to create a saved voice you can reuse later.
                  </Text>
                </View>
                <Ionicons
                  name={isSaveVoiceExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {isSaveVoiceExpanded ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                    Record your voice live in the app. We will stop automatically after 30 seconds, then you can confirm the take or re-record it.
                  </Text>
                  <TextInput
                    value={cloneVoiceName}
                    onChangeText={setCloneVoiceName}
                    placeholder="Example: My work voice"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="Saved voice name"
                    accessibilityHint="Give your saved voice a short name before recording the sample audio."
                    style={{
                      marginTop: 10,
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.textPrimary,
                      backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
                    }}
                  />
                  <View className="mt-3 flex-row">
                    <AppButton
                      label={isCloningVoice ? 'Saving...' : 'Record My Voice'}
                      iconName="mic-outline"
                      compact
                      onPress={() => {
                        if (!isCloningVoice) {
                          setErrorMessage('');
                          setStatusNotice('');
                          setIsVoiceRecorderOpen(true);
                        }
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <VoiceCloneRecorderModal
              visible={isVoiceRecorderOpen}
              title="Save my voice"
              description="Record your voice live for cloning. Recording cannot be dismissed once it starts, and it stops automatically after 30 seconds."
              voiceName={cloneVoiceName}
              voiceNameLabel="Saved voice name"
              voiceNamePlaceholder="Example: My work voice"
              voiceNameHint="Give your saved voice a short name before recording."
              submitLabel="Use recording"
              submittingLabel="Saving voice..."
              isSubmitting={isCloningVoice}
              onChangeVoiceName={setCloneVoiceName}
              onClose={() => setIsVoiceRecorderOpen(false)}
              onSubmitRecording={cloneVoice}
              onAnnounce={announce}
            />

            <SelectionModal
              visible={isClonedVoicePickerOpen}
              title="Choose a saved voice"
              subtitle="Preview your saved voices and choose one whenever it is ready."
              onClose={() => setIsClonedVoicePickerOpen(false)}
              colors={colors}
              isDark={isDark}
            >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
              Saved voices
            </Text>
            {isClonesLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : clonedVoices.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                You have not saved any voices yet.
              </Text>
            ) : (
              clonedVoices.map((voice) => {
                const isSelected = selectedVoice?.kind === 'clone' && selectedVoice.fishAudioId === voice.fishAudioId;
                const previewCacheKey = `clone:${voice.fishAudioId}`;
                const isTargetPreview = previewVoiceId === previewCacheKey;
                const isLoadingPreview = isTargetPreview && previewState === 'loading';
                const isPlaying = isTargetPreview && previewState === 'playing';
                const isReady = voice.status === 'ready';

                return (
                  <View
                    key={voice.id}
                    className="mb-3 rounded-[22px] border p-4"
                    style={{
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}10` : (isDark ? '#11151D' : '#FFFFFF'),
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                          {voice.name}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                          {[voice.status, voice.createdAt ? formatDateLabel(voice.createdAt) : null].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      <View className="rounded-full px-3 py-1" style={{ backgroundColor: isReady ? `${colors.primary}12` : 'rgba(234,179,8,0.12)' }}>
                        <Text style={{ color: isReady ? colors.primary : '#B45309', fontSize: 11, fontWeight: '700' }}>
                          {isReady ? 'Ready' : voice.status}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row flex-wrap items-center">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? `Stop ${voice.name} preview` : `Preview saved voice ${voice.name}`}
                        accessibilityHint="Plays a short sample of your saved voice."
                        disabled={!isReady}
                        onPress={() => {
                          if (isReady) {
                            void previewVoice({ cacheKey: previewCacheKey, fishAudioId: voice.fishAudioId });
                          }
                        }}
                        className="rounded-full px-3 py-2"
                        style={{
                          borderWidth: 1.2,
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#0C0E13' : '#FFFFFF',
                          opacity: isReady ? 1 : 0.5,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                          {!isReady ? 'Processing...' : isLoadingPreview ? 'Loading...' : isPlaying ? 'Stop Preview' : 'Preview Voice'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={`Select saved voice ${voice.name}`}
                        accessibilityState={{ selected: isSelected, disabled: !isReady }}
                        disabled={!isReady}
                        onPress={() => {
                          setSelectedVoice({ kind: 'clone', fishAudioId: voice.fishAudioId, label: voice.name });
                          setIsClonedVoicePickerOpen(false);
                        }}
                        className="ml-2 rounded-full px-3 py-2"
                        style={{
                          borderWidth: 1.2,
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? `${colors.primary}14` : (isDark ? '#0C0E13' : '#FFFFFF'),
                          opacity: isReady ? 1 : 0.5,
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                          {isSelected ? 'Selected' : 'Use This Voice'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            </SelectionModal>
          </SectionCard>

          <SectionCard
            title="4. Create the video"
            subtitle="Create your video with the selected avatar, edited script, and chosen voice."
            colors={colors}
            isDark={isDark}
          >
            <View
              className="rounded-[22px] border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                Ready to send
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                Avatar: {selectedAvatarType === 'upload' ? 'Your uploaded portrait' : selectedGalleryAvatarName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                Voice: {selectedVoice?.label || 'Not selected'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                Script length: {scriptText.trim().split(/\s+/).filter(Boolean).length} words
              </Text>
            </View>

            <View className="mt-4 flex-row items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={activeJobMeta ? 'Avatar generation in progress' : isStartingGeneration ? 'Starting avatar generation' : 'Generate avatar video'}
                accessibilityHint="Creates your talking avatar video using the selected image, script, and voice."
                disabled={!canGenerateVideo || isStartingGeneration || Boolean(activeJobMeta)}
                onPress={() => { void startGeneration(); }}
                className="rounded-full px-4 py-3"
                style={{
                  backgroundColor: canGenerateVideo && !isStartingGeneration && !activeJobMeta ? colors.primary : `${colors.primary}66`,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {activeJobMeta ? 'Generation In Progress' : isStartingGeneration ? 'Starting...' : 'Generate Video'}
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          {activeJobMeta ? (
            <View
              accessibilityViewIsModal
              className="mb-4 rounded-[28px] border px-5 py-5"
              style={{
                borderColor: colors.primary,
                backgroundColor: isDark ? '#0B1320' : '#F8FAFF',
              }}
            >
              <AvatarGenerationLoader colors={colors} isDark={isDark} status={activeJobStatus?.status} />
              <Text
                className="mt-5 text-center"
                style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}
              >
                Generating your avatar video
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
                {statusMessageForAvatarJob(activeJobStatus?.status)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                This process usually takes 5 to 10 minutes. You can leave the screen and come back later. The app will resume polling your pending job automatically.
              </Text>
              <View style={{ marginTop: 16 }}>
                <AppButton
                  label={isCancellingGeneration ? 'Cancelling...' : 'Cancel Generation'}
                  iconName="close-circle-outline"
                  compact
                  variant="outline"
                  loading={isCancellingGeneration}
                  onPress={cancelGeneration}
                />
              </View>
            </View>
          ) : null}

          {currentResult?.status.videoUrl ? (
            <SectionCard
              title="5. Result"
              subtitle="Your generated avatar video is ready to preview, save, share, or use as the starting point for another one."
              colors={colors}
              isDark={isDark}
            >
              <ChatVideoCard
                uri={currentResult.status.videoUrl}
                width={resultVideoWidth}
                height={Math.floor(resultVideoWidth * 0.5625)}
                borderColor={colors.border}
                backgroundColor={isDark ? '#101010' : '#FFFFFF'}
                accessibilityLabel="Generated avatar video"
              />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 14 }}>
                Voice: {currentResult.meta.voiceLabel}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                Created: {formatDateLabel(currentResult.status.createdAt || currentResult.meta.createdAt)}
              </Text>
              {formatGenerationSeconds(currentResult.status.generationTime) ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  Generation time: {formatGenerationSeconds(currentResult.status.generationTime)}
                </Text>
              ) : null}
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
                Script used
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
                {currentResult.status.scriptText || currentResult.meta.scriptText}
              </Text>
              <View className="mt-4 flex-row flex-wrap">
                <AppButton
                  label={isDownloadingCurrent ? 'Saving...' : 'Download'}
                  iconName="download-outline"
                  compact
                  onPress={() => {
                    if (currentResult.status.videoUrl && !isDownloadingCurrent) {
                      void downloadVideoToDevice(currentResult.status.videoUrl, currentResult.meta.userGoal || currentResult.meta.jobId);
                    }
                  }}
                />
                <View style={{ width: 8, height: 8 }} />
                <AppButton
                  label="Share"
                  iconName="share-social-outline"
                  compact
                  variant="outline"
                  loading={isSharingCurrent}
                  onPress={() => {
                    if (currentResult.status.videoUrl && !isSharingCurrent) {
                      void shareVideo(currentResult.status.videoUrl, currentResult.meta.userGoal || currentResult.meta.jobId);
                    }
                  }}
                />
              </View>
              <View style={{ marginTop: 12 }}>
                <AppButton
                  label="Create Another"
                  iconName="refresh-outline"
                  compact
                  variant="outline"
                  onPress={resetComposer}
                />
              </View>
            </SectionCard>
          ) : null}

          {false ? <SectionCard
            title="History"
            subtitle="Replay your completed avatar videos and save them again whenever you need them."
            colors={colors}
            isDark={isDark}
          >
            {!hasLoadedHistory && !isHistoryLoading ? (
              <View className="rounded-[22px] border p-4" style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#F8FAFC' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                  Load your recent avatar videos only when you need them.
                </Text>
                <View className="mt-4 flex-row">
                  <AppButton
                    label="Load History"
                    iconName="time-outline"
                    compact
                    onPress={() => {
                      void loadHistory();
                    }}
                  />
                </View>
              </View>
            ) : null}

            {isHistoryLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : hasLoadedHistory && history.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                No completed avatar videos yet. Your finished videos will appear here automatically.
              </Text>
            ) : hasLoadedHistory ? (
              history.map((item) => (
                <View
                  key={item.id}
                  className="mb-4 rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#FFFFFF' }}
                >
                  {item.videoUrl ? (
                    <ChatVideoCard
                      uri={item.videoUrl}
                      width={historyVideoWidth}
                      height={Math.floor(historyVideoWidth * 0.5625)}
                      borderColor={colors.border}
                      backgroundColor={isDark ? '#101010' : '#FFFFFF'}
                      accessibilityLabel={`Avatar video from ${formatDateLabel(item.createdAt)}`}
                    />
                  ) : null}
                  <View className="mt-3 flex-row items-start">
                    {item.avatarImageUrl ? (
                      <ExpoImage
                        source={{ uri: item.avatarImageUrl }}
                        style={{ width: 56, height: 72, borderRadius: 14, backgroundColor: isDark ? '#0C0E13' : '#F8FAFC' }}
                        contentFit="cover"
                        accessible
                        accessibilityLabel="Avatar source preview"
                      />
                    ) : null}
                    <View style={{ flex: 1, marginLeft: item.avatarImageUrl ? 12 : 0 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {item.voiceName || 'Avatar video'}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                        {formatDateLabel(item.createdAt)}
                      </Text>
                      {formatGenerationSeconds(item.generationTime) ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                          Generation time: {formatGenerationSeconds(item.generationTime)}
                        </Text>
                      ) : null}
                      {item.scriptText ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }} numberOfLines={4}>
                          {item.scriptText}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View className="mt-4 flex-row flex-wrap">
                    <AppButton
                      label={downloadingHistoryId === item.id ? 'Saving...' : 'Download'}
                      iconName="download-outline"
                      compact
                      onPress={() => {
                        if (item.videoUrl && downloadingHistoryId !== item.id) {
                          void downloadVideoToDevice(item.videoUrl, item.id, item.id);
                        }
                      }}
                    />
                    <View style={{ width: 8, height: 8 }} />
                    <AppButton
                      label="Share"
                      iconName="share-social-outline"
                      compact
                      variant="outline"
                      loading={sharingHistoryId === item.id}
                      onPress={() => {
                        if (item.videoUrl && sharingHistoryId !== item.id) {
                          void shareVideo(item.videoUrl, item.id, item.id);
                        }
                      }}
                    />
                  </View>
                </View>
              ))
            ) : null}
          </SectionCard> : null}
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}
