import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import {
  Alert,
  type GestureResponderEvent,
  AccessibilityInfo,
  ActivityIndicator,
  Dimensions,
  findNodeHandle,
  Keyboard, 
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  DedicatedMediaScreen,
  DocumentWizardArtifact,
  MediaPromptRewriteIntent,
  MediaPromptRewriteResult,
  PromptSuggestionContext,
} from '@/types';
import * as Clipboard from 'expo-clipboard';
import * as ExpoDocumentPicker from 'expo-document-picker';
import * as ExpoImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { File, Paths } from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-yaml';

import {
  AppScreen,
  AppLogo,
  ChatVideoCard,
  DocumentWizardCard,
  FileGenerationPlaceholder,
  ImageLightbox,
  PromptSuggestionsModal,
  CHAT_MODEL_OPTIONS,
  GUEST_TTS_RATE,
  ImageRequirementCard,
  ImageGenerationPlaceholder,
  ImageMessageActionsRow,
  MessageActionsRow,
  RecordingWaves,
  ScreenHandoffCard,
  extractImagePrompt,
  extractVideoPrompt,
  resolveModelBadgeLabel,
  UserPromptActionsRow,
  VideoGenerationPlaceholder,
  createStarterPromptCycler,
  getStarterPromptPool,
  createIdempotencyKey,
  getPromptTitle,
  isLikelyImageGenerationIntent,
  isLikelyImageFollowUpPrompt,
  isLikelyReferencedMediaQuestionPrompt,
  isLikelyVideoGenerationIntent,
  isLikelyVideoFollowUpPrompt,
  isMediaGenerationPrompt,
  type AttachedAsset,
  type UiMessage,
  type UiMessageAttachment,
} from '@/components';
import { AppPromptModal } from '@/components/ui/AppPromptModal';
import { useAppContext } from '@/context';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { pickSingleImageFromLibrary } from '@/utils/deviceImagePicker';
import {
  createAuthenticatedConversation,
  createGuestConversation,
  ensureGuestSession,
  editImage,
  fetchPromptSuggestions,
  generateImage,
  getDedicatedMediaConversation,
  generateVideoFromImageDirect,
  syncSubscriptionState,
  getSubscriptionOverview,
  getAuthenticatedConversation,
  getGuestConversation,
  getVoiceCatalog,
  pollVideoJob,
  rewriteMediaPrompt,
  getArtifactsPage,
  sendAuthenticatedMessageStream,
  sendAuthenticatedMessageNonStream,
  sendGuestMessageStream,
  startVideoGeneration,
  startVideoGenerationFromImage,
  synthesizeVoice,
  toggleAuthenticatedMessageReaction,
  isDedicatedMediaConversationUnavailable,
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import {
  clearDocumentWizardDraftMessages,
  classifyChatResponse,
  detectDocumentRequest,
  emitChatMutated,
  getActiveDocumentWizardDraftKey,
  getDocumentWizardDraftMessages,
  getAccessToken,
  getDefaultVoicePreference,
  setDocumentWizardDraftMessages,
  startDocumentWizard,
} from '@/services';
import {
  IOS_PHOTO_PERMISSION_DENIED_CODE,
  MOTION,
  hapticError,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  saveFileToDownloadsCafaFolder,
  saveMediaToCafaAlbum,
} from '@/utils';

// hi

type AudioPlayer = {
  addListener: (eventName: string, listener: (status: { didJustFinish?: boolean }) => void) => { remove: () => void };
  play: () => void;
  pause: () => void;
  remove: () => void;
};

type ExpoAudioModule = {
  createAudioPlayer: (uri: string, options?: { keepAudioSessionActive?: boolean }) => AudioPlayer;
};

type ImagePickerModule = {
  launchImageLibraryAsync: typeof ExpoImagePicker.launchImageLibraryAsync;
  launchCameraAsync: typeof ExpoImagePicker.launchCameraAsync;
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
};

type DocumentPickerModule = {
  getDocumentAsync: (options: {
    copyToCacheDirectory: boolean;
    multiple: boolean;
    type: string | string[];
  }) => Promise<{
    canceled: boolean;
    assets?: { name?: string | null; uri: string; mimeType?: string | null }[];
  }>;
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void>;
};

type ExpoWebBrowserModule = {
  openBrowserAsync: (url: string) => Promise<unknown>;
};

type ComposerMediaReference = {
  kind: 'image' | 'video';
  id?: string;
  url: string;
};

type ChatScreenMode = 'chat' | 'image-to-video' | 'edit-image';

type ScreenHandoffConfig = {
  target: 'index' | 'image-to-video' | 'edit-image';
  title: string;
  description: string;
  ctaLabel: string;
  iconName: 'chatbubble-ellipses-outline' | 'film-outline' | 'color-wand-outline';
};

type ImageRequirementConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  iconName: 'image-outline';
};

let expoAudioModulePromise: Promise<ExpoAudioModule> | null = null;
let imagePickerModulePromise: Promise<ImagePickerModule> | null = null;
let documentPickerModulePromise: Promise<DocumentPickerModule> | null = null;
let sharingModulePromise: Promise<unknown> | null = null;
let webBrowserModulePromise: Promise<ExpoWebBrowserModule> | null = null;

function focusAccessibilityNode(target: View | null) {
  const node = target ? findNodeHandle(target) : null;
  if (node) {
    AccessibilityInfo.setAccessibilityFocus?.(node);
  }
}

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

async function getImagePickerModule() {
  try {
    if (!imagePickerModulePromise) {
      imagePickerModulePromise = import('expo-image-picker') as Promise<ImagePickerModule>;
    }
    const loaded = await imagePickerModulePromise;
    const moduleCandidate = ((loaded as { default?: unknown })?.default ?? loaded) as Partial<ImagePickerModule> | null | undefined;
    if (!moduleCandidate || typeof moduleCandidate.launchImageLibraryAsync !== 'function') {
      const staticCandidate = ExpoImagePicker as Partial<ImagePickerModule>;
      if (typeof staticCandidate.launchImageLibraryAsync === 'function') {
        return staticCandidate as ImagePickerModule;
      }
      throw new Error('Image picker module is not available.');
    }
    return moduleCandidate as ImagePickerModule;
  } catch (error) {
    imagePickerModulePromise = null;
    const staticCandidate = ExpoImagePicker as Partial<ImagePickerModule>;
    if (typeof staticCandidate.launchImageLibraryAsync === 'function') {
      return staticCandidate as ImagePickerModule;
    }
    if (__DEV__) {
      console.log('[image-picker:load-failed]', error);
    }
    throw new Error('Image picker is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getDocumentPickerModule() {
  try {
    if (!documentPickerModulePromise) {
      documentPickerModulePromise = import('expo-document-picker') as Promise<DocumentPickerModule>;
    }
    const loaded = await documentPickerModulePromise;
    const moduleCandidate =
      ((loaded as { default?: unknown })?.default ?? loaded) as Partial<DocumentPickerModule> | null | undefined;
    if (!moduleCandidate || typeof moduleCandidate.getDocumentAsync !== 'function') {
      const staticCandidate = ExpoDocumentPicker as Partial<DocumentPickerModule>;
      if (typeof staticCandidate.getDocumentAsync === 'function') {
        return staticCandidate as DocumentPickerModule;
      }
      throw new Error('Document picker module is not available.');
    }
    return moduleCandidate as DocumentPickerModule;
  } catch (error) {
    documentPickerModulePromise = null;
    const staticCandidate = ExpoDocumentPicker as Partial<DocumentPickerModule>;
    if (typeof staticCandidate.getDocumentAsync === 'function') {
      return staticCandidate as DocumentPickerModule;
    }
    if (__DEV__) {
      console.log('[document-picker:load-failed]', error);
    }
    throw new Error('Document picker is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getSharingModule() {
  try {
    if (!sharingModulePromise) {
      // Use Promise.resolve().then(...) so sync module-resolution failures are caught here.
      sharingModulePromise = Promise.resolve().then(() => import('expo-sharing'));
    }
    const loaded = await sharingModulePromise;
    const candidate = (loaded as { default?: unknown })?.default ?? loaded;
    const moduleLike = candidate as Partial<SharingModule> | null | undefined;
    if (
      moduleLike
      && typeof moduleLike.isAvailableAsync === 'function'
      && typeof moduleLike.shareAsync === 'function'
    ) {
      return moduleLike as SharingModule;
    }
    console.log('[sharing:unavailable] expo-sharing loaded but API shape is invalid.');
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[sharing:load-error] ${message}`);
    sharingModulePromise = null;
    return null;
  }
}

async function getWebBrowserModule() {
  if (!webBrowserModulePromise) {
    webBrowserModulePromise = import('expo-web-browser') as Promise<ExpoWebBrowserModule>;
  }

  try {
    return await webBrowserModulePromise;
  } catch {
    webBrowserModulePromise = null;
    throw new Error('In-app browser is unavailable in this build.');
  }
}

export default function ChatScreen({ screenMode = 'chat' }: { screenMode?: ChatScreenMode } = {}) {
  const COMPOSER_MIN_HEIGHT = 32;
  const COMPOSER_MAX_HEIGHT = 120;
  const COMPOSER_VERTICAL_PADDING = Platform.OS === 'ios' ? 6 : 4;
  const ANDROID_KEYBOARD_CALIBRATION = 6;
  const STREAM_FLUSH_INTERVAL_MS = 36;
  const STREAM_FLUSH_CHARS = 28;
  const VIDEO_JOB_POLL_ATTEMPTS = 300;
  const VIDEO_JOB_POLL_INTERVAL_MS = 4000;
  const VIDEO_JOB_RATE_LIMIT_BACKOFF_MS = 9000;
  const VIDEO_AUTO_SYNC_ATTEMPTS = 40;
  const VIDEO_AUTO_SYNC_INTERVAL_MS = 12000;
  const LIMIT_RESTORE_SYNC_TIMEOUT_MS = 60_000;
  const LIMIT_RESTORE_SYNC_POLL_MS = 3_000;
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, authUser, refreshAuthUser, setAuthSubscriptionTier } = useAppContext();
  const { restorePurchases, refreshCustomerInfo } = useRevenueCat();
  const { t, language } = useI18n();
  const screenConfig = useMemo(() => {
    if (screenMode === 'image-to-video') {
      return {
        welcome:
          'This section is for generating a video based on an image. Upload an image, then describe the motion, camera movement, or scene you want.',
        attachmentMenuAnnouncement: 'Upload menu opened. Choose image upload.',
        uploadTriggerLabel: 'Upload',
        uploadTriggerHint: 'Opens upload options.',
        attachImageLabel: 'Image upload',
        attachImageHint: 'Opens your photo library to select an image.',
        attachDocumentLabel: 'Document upload',
        attachDocumentHint: 'Opens the document picker.',
        allowDocumentAttachment: false,
        placeholder: 'Describe the motion, camera movement, or scene you want...',
      };
    }
    if (screenMode === 'edit-image') {
      return {
        welcome:
          'This section is for editing an image. Upload an image, then describe the changes, style updates, or fixes you want.',
        attachmentMenuAnnouncement: 'Upload menu opened. Choose image upload.',
        uploadTriggerLabel: 'Upload',
        uploadTriggerHint: 'Opens upload options.',
        attachImageLabel: 'Image upload',
        attachImageHint: 'Opens your photo library to select an image.',
        attachDocumentLabel: 'Document upload',
        attachDocumentHint: 'Opens the document picker.',
        allowDocumentAttachment: false,
        placeholder: 'Describe the changes, style updates, or fixes you want...',
      };
    }
    return {
      welcome: t('chat.welcome'),
      attachmentMenuAnnouncement: 'Upload menu opened. Choose image upload or document upload.',
      uploadTriggerLabel: 'Upload',
      uploadTriggerHint: 'Opens upload options.',
      attachImageLabel: 'Image upload',
      attachImageHint: 'Opens your photo library to select an image.',
      attachDocumentLabel: 'Document upload',
      attachDocumentHint: 'Opens the document picker.',
      allowDocumentAttachment: true,
      placeholder: t('chat.input.placeholder'),
    };
  }, [screenMode, t]);
  const createWelcomeMessage = useCallback(
    (): UiMessage => ({
      id: 'welcome-1',
      role: 'assistant',
      content: screenConfig.welcome,
      createdAt: Date.now(),
    }),
    [screenConfig.welcome],
  );
  const isDedicatedMediaScreen = screenMode === 'image-to-video' || screenMode === 'edit-image';
  const params = useLocalSearchParams<{ conversationId?: string; newChat?: string; messageId?: string }>();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUnderstandingPrompt, setIsUnderstandingPrompt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [uploadOptionModalVisible, setUploadOptionModalVisible] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedAssets, setAttachedAssets] = useState<AttachedAsset[]>([]);
  const [tooltipState, setTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeModel, setActiveModel] = useState<'ultra' | 'smart' | 'swift'>('smart');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isHydratingAuthChat, setIsHydratingAuthChat] = useState(false);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);
  const [composerScrollable, setComposerScrollable] = useState(false);
  const [androidComposerOffset, setAndroidComposerOffset] = useState(0);
  const [iosComposerOffset, setIosComposerOffset] = useState(0);
  const [authConversationId, setAuthConversationId] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState('');
  const [upgradeNoticeKind, setUpgradeNoticeKind] = useState<'chat' | 'image' | 'video' | null>(null);
  const [upgradeNoticeResetHours, setUpgradeNoticeResetHours] = useState<number | null>(null);
  const [isLimitRestoreSyncing, setIsLimitRestoreSyncing] = useState(false);
  const [guestUpsellVisible, setGuestUpsellVisible] = useState(false);
  const [downloadToastNotice, setDownloadToastNotice] = useState('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [sharingMediaMessageId, setSharingMediaMessageId] = useState<string | null>(null);
  const [composerMediaReference, setComposerMediaReference] = useState<ComposerMediaReference | null>(null);
  const [highlightedReferencedMediaTarget, setHighlightedReferencedMediaTarget] = useState<{
    messageId: string;
    kind: 'image' | 'video';
  } | null>(null);
  const [ttsToastNotice, setTtsToastNotice] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [assetAccessToken, setAssetAccessToken] = useState<string | null>(null);
  const [readAloudSpeaker, setReadAloudSpeaker] = useState<string | null>(null);
  const [isReadAloudLoading, setIsReadAloudLoading] = useState(false);
  const [streamingDots, setStreamingDots] = useState('.');
  const [streamingModelLabel, setStreamingModelLabel] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);
  const [imageLightboxUri, setImageLightboxUri] = useState<string | null>(null);
  const [promptSuggestionsVisible, setPromptSuggestionsVisible] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [isPromptSuggestionsLoading, setIsPromptSuggestionsLoading] = useState(false);
  const [documentFormWarningVisible, setDocumentFormWarningVisible] = useState(false);
  const canAttachDocuments = isAuthenticated && (authUser?.subscriptionTier ?? 'free') !== 'free';
  const allowDocumentAttachment = screenConfig.allowDocumentAttachment && canAttachDocuments;
  const tier = authUser?.subscriptionTier ?? 'free';
  const canUseUltraModel = isAuthenticated && (tier === 'cafa_pro' || tier === 'cafa_max');
  const availableChatModelOptions = useMemo(
    () => CHAT_MODEL_OPTIONS.filter((option) => option.key !== 'ultra' || canUseUltraModel),
    [canUseUltraModel],
  );
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const dedicatedComposerHelperText = useMemo(() => {
    if (!isDedicatedMediaScreen) return '';
    const hasPrompt = input.trim().length > 0;
    const hasImage = attachedAssets.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));

    if (!hasPrompt && !hasImage) return 'Upload an image and add a prompt to continue.';
    if (!hasPrompt) {
      return screenMode === 'image-to-video'
        ? 'Add a prompt describing the motion, camera movement, or scene you want.'
        : 'Add a prompt describing the changes you want.';
    }
    if (!hasImage) return 'Upload an image to continue.';
    return '';
  }, [attachedAssets, input, isDedicatedMediaScreen, screenMode]);
  const hasPromptSuggestionTrigger = input.trim().length > 0;
  const messagesListRef = useRef<FlashListRef<UiMessage>>(null);
  const lastJumpedMessageKeyRef = useRef<string>('');
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const composerInputRef = useRef<TextInput>(null);
  const inputValueRef = useRef('');
  const promptSuggestionAbortRef = useRef<AbortController | null>(null);
  const promptSuggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestUpsellStateRef = useRef<{ windowStartedAt: number; responseCount: number; shown: boolean }>({
    windowStartedAt: 0,
    responseCount: 0,
    shown: false,
  });
  const menuTouchRef = useRef(false);
  const documentDraftHydratedRef = useRef(false);
  const conversationHydrationRequestRef = useRef(0);
  const routedConversationIdRef = useRef('');
  routedConversationIdRef.current = typeof params.conversationId === 'string' ? params.conversationId : '';
  const uploadTriggerButtonRef = useRef<View | null>(null);
  const uploadImageOptionRef = useRef<View | null>(null);
  const uploadDocumentOptionRef = useRef<View | null>(null);
  const uploadCancelOptionRef = useRef<View | null>(null);
  const takePhotoOptionRef = useRef<View | null>(null);
  const chooseGalleryOptionRef = useRef<View | null>(null);
  const chooserCancelOptionRef = useRef<View | null>(null);
  const speechDraftRef = useRef('');
  const isRecordingRef = useRef(false);
  const activeReadAloudRequestRef = useRef(0);
  const assistantFirstDeltaRef = useRef(false);
  const pendingDeltaRef = useRef('');
  const pendingAssistantIdRef = useRef<string | null>(null);
  const deltaFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsPlayerRef = useRef<AudioPlayer | null>(null);
  const ttsPlayerSubRef = useRef<{ remove: () => void } | null>(null);
  const ttsFilesRef = useRef<File[]>([]);
  const mediaShareInFlightRef = useRef(false);
  const sharedMediaCacheRef = useRef<Record<string, { uri: string; mimeType: string; fileName: string }>>({});
  const pendingReferencedUserMessagesRef = useRef<{
    sentAt: number;
    content: string;
    reference: ComposerMediaReference;
  }[]>([]);
  const referencedUserMessageByServerIdRef = useRef<Record<string, ComposerMediaReference>>({});
  const referencedMediaHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceNameByIdRef = useRef<Record<string, string>>({});
  const videoGenerationInFlightRef = useRef(false);
  const videoFromImageInFlightRef = useRef(false);
  const videoAutoSyncInFlightRef = useRef(false);
  const documentPickerInFlightRef = useRef(false);
  const lastVideoGenerationStartAtRef = useRef(0);
  const isSendRunInFlightRef = useRef(false);
  const lastSendAttemptAtRef = useRef(0);
  const sendAttemptSeqRef = useRef(0);
  const lastHandledNewChatTokenRef = useRef<string | null>(null);
  const initialNewChatTokenRef = useRef<string | null>(null);
  const starterPromptCyclerRef = useRef(createStarterPromptCycler(getStarterPromptPool(language)));

  useEffect(() => {
    starterPromptCyclerRef.current = createStarterPromptCycler(getStarterPromptPool(language));
  }, [language]);
  const screenWidth = Dimensions.get('window').width;
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  const GUEST_UPSELL_STATE_KEY = 'cafa_ai_guest_upsell_state_v1';
  const GUEST_UPSELL_AFTER_RESPONSES = 3;
  const GUEST_UPSELL_WINDOW_MS = 24 * 60 * 60 * 1000;
  const keyboardComposerOffset = Platform.OS === 'ios' ? iosComposerOffset : androidComposerOffset;
  const safeBottomInset = Math.max(insets.bottom, 0);
  const composerBottomInset = keyboardComposerOffset > 0 ? keyboardComposerOffset : 0;
  const topPillBg = isDark ? '#10264D' : '#204079';
  const topPillBorder = '#204079';
  const dividerPill = '#204079';
  const composerPlaceholder = useMemo(() => screenConfig.placeholder, [screenConfig.placeholder]);
  const useCompactComposerPlaceholder = screenMode === 'image-to-video' || screenMode === 'edit-image';
  const isWelcomeMessage = useCallback((message: UiMessage) => message.id === 'welcome-1', []);
  const isSendDisabled = (!input.trim() && attachedAssets.length === 0) || isSending || isUnderstandingPrompt || !!statusNotice;
  const clearDedicatedMediaValidationMessages = useCallback((options: { clearPromptRequired?: boolean; clearImageRequired?: boolean }) => {
    if (!options.clearPromptRequired && !options.clearImageRequired) return;

    setMessages((prev) => {
      const next = prev.filter((message) => {
        if (options.clearPromptRequired && message.id.startsWith('assistant-prompt-required-')) {
          return false;
        }
        if (options.clearImageRequired && message.id.startsWith('assistant-image-required-')) {
          return false;
        }
        return true;
      });

      return next.length === prev.length ? prev : next;
    });
  }, []);
  const isFreshChatState = !isSending && messages.length === 1 && isWelcomeMessage(messages[0]);
  const visibleMessages = useMemo(
    () => (isSending ? messages.filter((message) => !isWelcomeMessage(message)) : messages),
    [isSending, isWelcomeMessage, messages],
  );
  const announceForA11y = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  useEffect(() => {
    if (!isUnderstandingPrompt) return;
    announceForA11y('Understanding your prompt.');
  }, [announceForA11y, isUnderstandingPrompt]);

  const promptSuggestionContext = useMemo<PromptSuggestionContext>(() => {
    if (screenMode === 'edit-image') return 'edit-image';
    if (screenMode === 'image-to-video') return 'video';
    return 'chat';
  }, [language, screenMode]);

  const clearPromptSuggestions = useCallback((options?: { keepModalOpen?: boolean }) => {
    if (promptSuggestionDebounceRef.current) {
      clearTimeout(promptSuggestionDebounceRef.current);
      promptSuggestionDebounceRef.current = null;
    }
    if (promptSuggestionAbortRef.current) {
      promptSuggestionAbortRef.current.abort();
      promptSuggestionAbortRef.current = null;
    }
    setIsPromptSuggestionsLoading(false);
    setPromptSuggestions([]);
    if (!options?.keepModalOpen) {
      setPromptSuggestionsVisible(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < 3) {
      clearPromptSuggestions({ keepModalOpen: trimmed.length > 0 });
      return;
    }

    if (promptSuggestionDebounceRef.current) {
      clearTimeout(promptSuggestionDebounceRef.current);
    }

    promptSuggestionDebounceRef.current = setTimeout(() => {
      promptSuggestionAbortRef.current?.abort();
      const controller = new AbortController();
      promptSuggestionAbortRef.current = controller;
      setIsPromptSuggestionsLoading(true);

      void (async () => {
        const authToken = isAuthenticated ? undefined : (await ensureGuestSession()).guestSessionToken;
        return fetchPromptSuggestions({
          partialText: trimmed,
          context: promptSuggestionContext,
          authToken,
          signal: controller.signal,
        });
      })()
        .then((nextSuggestions) => {
          if (controller.signal.aborted) return;
          if (__DEV__) {
            console.log('[prompt-suggestions]', {
              screenMode,
              partialText: trimmed,
              suggestions: nextSuggestions,
            });
          }
          setPromptSuggestions(nextSuggestions);
        })
        .catch((error: unknown) => {
          const maybeError = error as { code?: string; name?: string };
          if (controller.signal.aborted || maybeError?.code === 'ERR_CANCELED' || maybeError?.name === 'CanceledError') {
            return;
          }
          if (__DEV__) {
            console.log('[prompt-suggestions:error]', {
              screenMode,
              partialText: trimmed,
              error,
            });
          }
          setPromptSuggestions([]);
        })
        .finally(() => {
          if (promptSuggestionAbortRef.current === controller) {
            promptSuggestionAbortRef.current = null;
          }
          if (!controller.signal.aborted) {
            setIsPromptSuggestionsLoading(false);
          }
        });
    }, 500);

    return () => {
      if (promptSuggestionDebounceRef.current) {
        clearTimeout(promptSuggestionDebounceRef.current);
        promptSuggestionDebounceRef.current = null;
      }
      promptSuggestionAbortRef.current?.abort();
      promptSuggestionAbortRef.current = null;
    };
  }, [clearPromptSuggestions, input, isAuthenticated, promptSuggestionContext, screenMode]);

  useEffect(() => {
    if (!isDedicatedMediaScreen) return;

    const hasPrompt = input.trim().length > 0;
    const hasImage = attachedAssets.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));

    clearDedicatedMediaValidationMessages({
      clearPromptRequired: hasPrompt,
      clearImageRequired: hasImage,
    });
  }, [attachedAssets, clearDedicatedMediaValidationMessages, input, isDedicatedMediaScreen]);

  const rotateStarterPrompts = useCallback(() => {
    if (screenMode === 'image-to-video') {
      setStarterPrompts([
        'Generate a video from this image with soft cinematic camera movement.',
        'Turn this image into a short product reveal video with subtle motion.',
        'Animate this image into a dramatic scene with slow zoom and drifting light.',
      ]);
      return;
    }
    if (screenMode === 'edit-image') {
      setStarterPrompts([
        'Edit this image by cleaning the background and improving the lighting.',
        'Retouch this image to look sharper, brighter, and more polished.',
        'Transform this image into a premium brand-style visual with better color balance.',
      ]);
      return;
    }
    const selected = starterPromptCyclerRef.current();
    if (selected.length) {
      setStarterPrompts(selected);
    }
  }, [screenMode]);

  const isLikelyImageEditIntent = useCallback((value: string) => {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return false;

    // Classic edit verbs paired with an image element cue
    const editVerb =
      /\b(edit|retouch|enhance|improve|fix|clean|cleanup|touch ?up|remove|replace|erase|crop|upscale|sharpen|brighten|darken|blur|restore|adjust|colorize|desaturate|saturate|stylize|filter|transform|overlay|swap|inpaint|outpaint|fill|extend|expand|redraw|repaint|recolor)\b/.test(normalized);
    const imageCue =
      /\b(image|photo|picture|background|foreground|lighting|light|shadow|color|colour|hue|tone|tint|shade|contrast|exposure|saturation|brightness|face|skin|eye|hair|object|element|subject|logo|texture|style|look|appearance|scene|sky|floor|wall|outfit|clothes)\b/.test(normalized);

    if (editVerb && imageCue) return true;

    // Natural transformation phrasing: "make it/the X", "change X to Y", "turn X into Y", "add X", "set X to Y"
    const naturalEdit =
      /\b(make (it|the|this|them|everything|all)|change (it|the|this|them|all|color|colour|background|lighting|light|style|look|appearance) to|turn (it|the|this|them) into|set (the|all|it) (color|colour|hue|tone|lighting|light|style) to|add (a |some )?(filter|effect|overlay|texture|color|colour|tint|shadow|glow|blur)|convert (to|into)|apply (a |the )?(filter|effect|style|look)|give it (a |the )?|put (a |the )?)/.test(normalized);

    return naturalEdit;
  }, []);

  const getImageRequirementConfig = useCallback((
    prompt: string,
    attachments: AttachedAsset[],
  ): ImageRequirementConfig | null => {
    const hasImageAttachment = attachments.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));
    if (hasImageAttachment) return null;

    const isVideoIntent = Boolean(extractVideoPrompt(prompt)) || isLikelyVideoGenerationIntent(prompt);
    const isEditIntent = isLikelyImageEditIntent(prompt);

    if (screenMode === 'image-to-video' && isVideoIntent) {
      return {
        title: 'Add an image first',
        description: 'Upload an image before sending this prompt so Cafa AI can generate a video from it.',
        ctaLabel: 'Upload image',
        iconName: 'image-outline',
      };
    }

    if (screenMode === 'edit-image' && isEditIntent) {
      return {
        title: 'Add an image first',
        description: 'Upload an image before sending this prompt so Cafa AI can edit it for you.',
        ctaLabel: 'Upload image',
        iconName: 'image-outline',
      };
    }

    return null;
  }, [isLikelyImageEditIntent, screenMode]);

  const getScreenHandoffConfig = useCallback((
    prompt: string,
    attachments: AttachedAsset[],
  ): ScreenHandoffConfig | null => {
    const hasImageAttachment = attachments.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));
    const isVideoIntent = Boolean(extractVideoPrompt(prompt)) || isLikelyVideoGenerationIntent(prompt);
    const isEditIntent = isLikelyImageEditIntent(prompt);

    if (screenMode === 'image-to-video') {
      if (hasImageAttachment && isEditIntent) {
        return {
          target: 'edit-image',
          title: 'Better in Edit Image',
          description: 'This request looks like editing an uploaded image. Use the Edit Image screen. For this task.',
          ctaLabel: 'Open Edit Image',
          iconName: 'color-wand-outline',
        };
      }
      if (!hasImageAttachment && isVideoIntent) {
        return null;
      }
      if (!isVideoIntent) {
        return {
          target: 'index',
          title: 'Use main chat for this',
          description: 'This screen is only for generating a video from an uploaded image. For anything else, continue in the main chat.',
          ctaLabel: 'Open main chat',
          iconName: 'chatbubble-ellipses-outline',
        };
      }
      return null;
    }

    if (screenMode === 'edit-image') {
      if (hasImageAttachment && isVideoIntent) {
        return {
          target: 'image-to-video',
          title: 'Better in Image-to-Video',
          description: 'This request looks like turning an uploaded image into a video. Use the dedicated image-to-video screen. For this task.',
          ctaLabel: 'Open Image-to-Video',
          iconName: 'film-outline',
        };
      }
      if (hasImageAttachment) {
        return null;
      }
      if (!hasImageAttachment && isEditIntent) {
        return null;
      }
      if (!isEditIntent) {
        return {
          target: 'index',
          title: 'Use main chat for this',
          description: 'This screen is only for editing an uploaded image. For general requests, continue in the main chat.',
          ctaLabel: 'Open main chat',
          iconName: 'chatbubble-ellipses-outline',
        };
      }
      return null;
    }

    return null;
  }, [isLikelyImageEditIntent, screenMode]);

  const getScreenHandoffConfigFromIntent = useCallback((
    intent: MediaPromptRewriteIntent,
  ): ScreenHandoffConfig | null => {
    if (screenMode === 'image-to-video') {
      if (intent === 'edit-image') {
        return {
          target: 'edit-image',
          title: 'Better in Edit Image',
          description: 'This request looks like editing an image. Use the Edit Image screen. For this task.',
          ctaLabel: 'Open Edit Image',
          iconName: 'color-wand-outline',
        };
      }
      if (intent === 'unsupported') {
        return {
          target: 'index',
          title: 'Use main chat for this',
          description: 'This screen is only for generating a video from an image. For anything else, continue in the main chat.',
          ctaLabel: 'Open main chat',
          iconName: 'chatbubble-ellipses-outline',
        };
      }
      return null;
    }

    if (screenMode === 'edit-image') {
      if (intent === 'image-to-video') {
        return {
          target: 'image-to-video',
          title: 'Better in Image-to-Video',
          description: 'This request looks like turning an image into a video. Use the dedicated image-to-video screen. For this task.',
          ctaLabel: 'Open Image-to-Video',
          iconName: 'film-outline',
        };
      }
      if (intent === 'unsupported') {
        return {
          target: 'index',
          title: 'Use main chat for this',
          description: 'This screen is only for editing an image. For general requests, continue in the main chat.',
          ctaLabel: 'Open main chat',
          iconName: 'chatbubble-ellipses-outline',
        };
      }
      return null;
    }

    return null;
  }, [screenMode]);

  const getScreenHandoffConfigFromAssistantText = useCallback((
    content: string,
  ): ScreenHandoffConfig | null => {
    const normalized = content
      .toLowerCase()
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return null;

    if (
      normalized.includes('/image-to-video')
      || normalized.includes('image to video screen')
      || normalized.includes('image-to-video screen')
    ) {
      return {
        target: 'image-to-video',
        title: 'Better in Image-to-Video',
        description: 'This request is better handled in the dedicated Image-to-Video screen.',
        ctaLabel: 'Open Image-to-Video',
        iconName: 'film-outline',
      };
    }

    if (
      normalized.includes('/edit-image')
      || normalized.includes('edit image screen')
    ) {
      return {
        target: 'edit-image',
        title: 'Better in Edit Image',
        description: 'This request is better handled in the dedicated Edit Image screen.',
        ctaLabel: 'Open Edit Image',
        iconName: 'color-wand-outline',
      };
    }

    if (normalized.includes('continue in the main chat') || normalized.includes('open main chat')) {
      return {
        target: 'index',
        title: 'Use main chat for this',
        description: 'This request is better handled in the main chat.',
        ctaLabel: 'Open main chat',
        iconName: 'chatbubble-ellipses-outline',
      };
    }

    return null;
  }, []);

  const jumpToReferencedMedia = (reference: ComposerMediaReference) => {
    const index = messages.findIndex((message) => {
      if (message.role !== 'assistant') return false;
      if (reference.kind === 'image') {
        if (reference.id && message.imageId === reference.id) return true;
        return Boolean(message.imageUrl && message.imageUrl === reference.url);
      }
      if (reference.id && message.videoId === reference.id) return true;
      return Boolean(message.videoUrl && message.videoUrl === reference.url);
    });

    if (index < 0) {
      showTransientNotice(t('chat.reference.jumpFailed'));
      return;
    }

    messagesListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
    const targetMessage = messages[index];
    setHighlightedReferencedMediaTarget({ messageId: targetMessage.id, kind: reference.kind });
    if (referencedMediaHighlightTimerRef.current) {
      clearTimeout(referencedMediaHighlightTimerRef.current);
    }
    referencedMediaHighlightTimerRef.current = setTimeout(() => {
      setHighlightedReferencedMediaTarget((current) => (
        current?.messageId === targetMessage.id && current.kind === reference.kind ? null : current
      ));
    }, 3000);
    hapticSelection();
    showTransientNotice(t('chat.reference.jumpSuccess'));
  };

  const openHandoffTarget = useCallback((target: 'index' | 'image-to-video' | 'edit-image') => {
    if (target === 'index') {
      void router.push('/(drawer)');
      return;
    }
    void router.push(`/${target}`);
  }, []);

  useEffect(() => () => {
    if (referencedMediaHighlightTimerRef.current) {
      clearTimeout(referencedMediaHighlightTimerRef.current);
      referencedMediaHighlightTimerRef.current = null;
    }
  }, []);

  const logSendPayload = useCallback((payload: Record<string, unknown>) => {
    if (!__DEV__) return;
    try {
      console.log('[chat-send:payload]', JSON.stringify(payload));
    } catch {
      console.log('[chat-send:payload]', payload);
    }
  }, []);

  const logUploadSelection = useCallback((payload: Record<string, unknown>) => {
    if (!__DEV__) return;
    try {
      console.log('[chat-upload:selection]', JSON.stringify(payload));
    } catch {
      console.log('[chat-upload:selection]', payload);
    }
  }, []);

  const resolveMediaPromptRewrite = useCallback(async (
    currentScreenMode: ChatScreenMode,
    prompt: string,
  ): Promise<MediaPromptRewriteResult | null> => {
    if (currentScreenMode !== 'image-to-video' && currentScreenMode !== 'edit-image') {
      return null;
    }

    try {
      const result = await rewriteMediaPrompt({
        screen: currentScreenMode,
        prompt,
        language,
      });
      if (__DEV__) {
        try {
          console.log('[media-prompt-rewrite:result]', JSON.stringify({
            screen: currentScreenMode,
            prompt,
            response: result,
            source: 'backend',
          }));
        } catch {
          console.log('[media-prompt-rewrite:result]', {
            screen: currentScreenMode,
            prompt,
            response: result,
            source: 'backend',
          });
        }
      }
      return result;
    } catch (error) {
      const typed = error as { status?: number; code?: string; message?: string } | undefined;
      const status = typed?.status ?? null;
      const code = (typed?.code ?? '').toUpperCase();

      if (status === 404 || status === 501 || code === 'ERR_BAD_REQUEST' || code === 'NOT_FOUND') {
        return null;
      }

      if (__DEV__) {
        try {
          console.log('[media-prompt-rewrite:fallback]', JSON.stringify({
          screen: currentScreenMode,
          prompt,
          status,
          code: typed?.code ?? null,
          message: typed?.message ?? null,
          source: 'frontend-fallback',
        }));
      } catch {
        console.log('[media-prompt-rewrite:fallback]', {
          screen: currentScreenMode,
          prompt,
          status,
          code: typed?.code ?? null,
          message: typed?.message ?? null,
          source: 'frontend-fallback',
        });
      }
    }

    return null;
    }
  }, [language]);

  useEffect(() => {
    rotateStarterPrompts();
  }, [rotateStarterPrompts]);

  useEffect(() => {
    // Avoid remounting TextInput on iOS to update placeholder text; remounting can
    // cause focus jitter with keyboard frame callbacks.
    composerInputRef.current?.setNativeProps?.({
      placeholder: useCompactComposerPlaceholder ? '' : composerPlaceholder,
    });
  }, [composerPlaceholder, useCompactComposerPlaceholder]);

  const openInAppBrowser = useCallback(async (url: string) => {
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      return;
    }
    try {
      const WebBrowser = await getWebBrowserModule();
      await WebBrowser.openBrowserAsync(target);
    } catch {
      const canOpen = await Linking.canOpenURL(target);
      if (canOpen) {
        await Linking.openURL(target);
      }
    }
  }, []);

  const resolveBackendAssetUrl = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) return rawUrl;
    if (/^data:/i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${backendOrigin}${rawUrl}`;
    return `${backendOrigin}/${rawUrl}`;
  }, [backendOrigin]);

  const isImageAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const type = (attachment.fileType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return (
      type === 'image'
      || mime.startsWith('image/')
      || name.endsWith('.png')
      || name.endsWith('.jpg')
      || name.endsWith('.jpeg')
      || name.endsWith('.gif')
      || name.endsWith('.webp')
    );
  }, []);

  const resolveAttachmentPreviewUri = useCallback((attachment: UiMessageAttachment) => {
    if (attachment.thumbnailUrl) {
      return resolveBackendAssetUrl(attachment.thumbnailUrl);
    }
    if (attachment.url) {
      return resolveBackendAssetUrl(attachment.url);
    }
    return null;
  }, [resolveBackendAssetUrl]);

  const isMarkdownAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return mime.includes('text/markdown') || name.endsWith('.md') || name.endsWith('.markdown');
  }, []);

  const isVideoAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const type = (attachment.fileType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return type === 'video' || mime.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov');
  }, []);

  const isGeneratedDownloadableFileAttachment = useCallback((attachment: UiMessageAttachment) => (
    Boolean(attachment.url) && !isImageAttachment(attachment) && !isVideoAttachment(attachment)
  ), [isImageAttachment, isVideoAttachment]);

  const inferFileExtensionFromMime = useCallback((mimeType?: string, fileName?: string) => {
    const name = (fileName ?? '').toLowerCase();
    const nameMatch = name.match(/\.([a-z0-9]+)$/i);
    if (nameMatch?.[1]) return nameMatch[1];
    const mime = (mimeType ?? '').toLowerCase();
    if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx';
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('markdown')) return 'md';
    if (mime.includes('csv')) return 'csv';
    if (mime.includes('json')) return 'json';
    if (mime.includes('plain')) return 'txt';
    return 'bin';
  }, []);

  const isGenericGeneratedFileName = useCallback((fileName?: string) => {
    const value = (fileName ?? '').trim().toLowerCase();
    if (!value) return true;
    return (
      /^generated[-_ ]?(document|file|artifact)/.test(value)
      || /^document[-_ ]?\d/.test(value)
      || /^file[-_ ]?\d/.test(value)
      || /^artifact[-_ ]?\d/.test(value)
      || /^untitled/.test(value)
    );
  }, []);

  const toReadableFileBaseFromPrompt = useCallback((prompt: string) => {
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return 'generated-file';

    const withoutCommand = normalized
      .replace(/^(generate|create|make|build|draft|write|produce|export)\s+/i, '')
      .replace(/^(a|an|the)\s+/i, '');

    let candidate = withoutCommand;
    const forMatch = /\bfor\s+(.+?)(?:\s+with|\s+including|\s+that|\s+in|\s*$)/i.exec(withoutCommand);
    if (forMatch?.[1]) {
      candidate = `${forMatch[1]} proposal`;
    }

    const words = candidate
      .split(' ')
      .filter((word) => ![
        'docx', 'pdf', 'csv', 'json', 'txt', 'markdown', 'file', 'document', 'artifact', 'sections', 'section',
      ].includes(word))
      .slice(0, 7);

    const base = words.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return base || 'generated-file';
  }, []);

  const suggestDescriptiveFileName = useCallback((options: {
    originalName?: string;
    mimeType?: string;
    fallbackText?: string;
  }) => {
    const extension = inferFileExtensionFromMime(options.mimeType, options.originalName);
    if (!isGenericGeneratedFileName(options.originalName)) {
      return options.originalName?.trim() || `generated-file.${extension}`;
    }
    const base = toReadableFileBaseFromPrompt(options.fallbackText ?? '');
    return `${base}.${extension}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  }, [inferFileExtensionFromMime, isGenericGeneratedFileName, toReadableFileBaseFromPrompt]);

  const assetUrlRequiresAuth = useCallback((uri?: string | null) => {
    if (!uri) return false;
    return /^https?:\/\//i.test(uri) && uri.includes('/uploads/');
  }, []);

  const resolveImageSource = useCallback((uri?: string | null) => {
    if (!uri) return null;
    if (!assetUrlRequiresAuth(uri)) {
      return { uri };
    }
    if (!assetAccessToken) return null;
    return {
      uri,
      headers: {
        Authorization: `Bearer ${assetAccessToken}`,
      },
    };
  }, [assetAccessToken, assetUrlRequiresAuth]);

  const mapAuthMessageToUiMessage = useCallback((message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    attachments?: {
      id?: string;
      fileType?: string;
      mimeType?: string;
      originalName?: string;
      url?: string;
      thumbnailUrl?: string;
    }[];
    imageUrl?: string;
    imagePrompt?: string;
    imageId?: string;
    videoUrl?: string;
    videoPrompt?: string;
    videoId?: string;
    reference?: {
      kind: 'image' | 'video';
      url: string;
      id?: string;
    };
    documentWizard?: {
      html: string;
      documentType: string;
      format: string;
      collapsed?: boolean;
      userMessageId?: string;
      assistantMessageId?: string;
    };
  }): UiMessage => {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const createdAtMs = new Date(message.createdAt).getTime();
    let referencedMedia: ComposerMediaReference | undefined;

    if (role === 'user') {
      if (message.reference?.kind && message.reference?.url) {
        referencedMedia = {
          kind: message.reference.kind,
          id: message.reference.id,
          url: resolveBackendAssetUrl(message.reference.url) ?? message.reference.url,
        };
        referencedUserMessageByServerIdRef.current[message.id] = referencedMedia;
      } else {
        const saved = referencedUserMessageByServerIdRef.current[message.id];
        if (saved) {
          referencedMedia = saved;
        } else {
          const normalizedContent = message.content.trim();
          let bestIdx = -1;
          let bestDistance = Number.POSITIVE_INFINITY;

          for (let i = 0; i < pendingReferencedUserMessagesRef.current.length; i += 1) {
            const candidate = pendingReferencedUserMessagesRef.current[i];
            if (candidate.content.trim() !== normalizedContent) continue;
            const distance = Math.abs(createdAtMs - candidate.sentAt);
            if (distance < bestDistance && distance <= 2 * 60 * 1000) {
              bestDistance = distance;
              bestIdx = i;
            }
          }

          if (bestIdx >= 0) {
            const matched = pendingReferencedUserMessagesRef.current[bestIdx].reference;
            referencedMedia = matched;
            referencedUserMessageByServerIdRef.current[message.id] = matched;
            pendingReferencedUserMessagesRef.current.splice(bestIdx, 1);
          }
        }
      }
    }

    const normalizedAttachments = (message.attachments ?? []).map((attachment) => ({
      ...attachment,
      url: resolveBackendAssetUrl(attachment.url) ?? attachment.url,
      thumbnailUrl: resolveBackendAssetUrl(attachment.thumbnailUrl) ?? attachment.thumbnailUrl,
    }));

    const normalizedImageUrl = resolveBackendAssetUrl(message.imageUrl) ?? undefined;
    const normalizedVideoUrl = resolveBackendAssetUrl(message.videoUrl) ?? undefined;
    const fallbackImageAttachment = normalizedAttachments.find((attachment) => {
      const fileType = (attachment.fileType ?? '').toLowerCase();
      const mime = (attachment.mimeType ?? '').toLowerCase();
      const name = (attachment.originalName ?? '').toLowerCase();
      return (
        fileType === 'image'
        || mime.startsWith('image/')
        || name.endsWith('.png')
        || name.endsWith('.jpg')
        || name.endsWith('.jpeg')
        || name.endsWith('.webp')
        || name.endsWith('.gif')
      );
    });
    const fallbackVideoAttachment = normalizedAttachments.find((attachment) => {
      const fileType = (attachment.fileType ?? '').toLowerCase();
      const mime = (attachment.mimeType ?? '').toLowerCase();
      const name = (attachment.originalName ?? '').toLowerCase();
      return (
        fileType === 'video'
        || mime.startsWith('video/')
        || name.endsWith('.mp4')
        || name.endsWith('.mov')
        || name.endsWith('.webm')
      );
    });

    const effectiveImageUrl = normalizedImageUrl
      ?? fallbackImageAttachment?.url
      ?? fallbackImageAttachment?.thumbnailUrl
      ?? undefined;
    const effectiveVideoUrl = normalizedVideoUrl
      ?? fallbackVideoAttachment?.url
      ?? fallbackVideoAttachment?.thumbnailUrl
      ?? undefined;

    return {
      id: message.id,
      role,
      content: getScreenHandoffConfigFromAssistantText(message.content) ? '' : message.content,
      createdAt: createdAtMs,
      referencedMedia,
      tokens: message.tokens,
      attachments: normalizedAttachments,
      imageUrl: effectiveImageUrl,
      imagePrompt: message.imagePrompt,
      imageId: message.imageId,
      videoUrl: effectiveVideoUrl,
      videoPrompt: message.videoPrompt,
      videoId: message.videoId,
      screenHandoff: role === 'assistant' ? getScreenHandoffConfigFromAssistantText(message.content) ?? undefined : undefined,
      documentWizard: message.documentWizard
        ? {
            html: message.documentWizard.html,
            documentType: message.documentWizard.documentType,
            format: message.documentWizard.format,
            collapsed: message.documentWizard.collapsed,
            userMessageId: message.documentWizard.userMessageId,
            assistantMessageId: message.documentWizard.assistantMessageId,
          }
        : undefined,
    };
  }, [getScreenHandoffConfigFromAssistantText, resolveBackendAssetUrl]);

  const mapDedicatedMediaConversationToAuthDetail = useCallback((conversation: {
    id: string;
    title: string;
    screen: DedicatedMediaScreen;
    model: string;
    updatedAt: string;
    messages: {
      _id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      createdAt: string;
      tokens?: number;
      reactions?: { liked?: boolean; disliked?: boolean };
      attachments?: {
        _id?: string;
        id?: string;
        type?: string;
        fileType?: string;
        mimeType?: string;
        fileName?: string;
        originalName?: string;
        url?: string;
        thumbnailUrl?: string;
      }[];
      reference?: {
        kind?: 'image' | 'video';
        url?: string;
        id?: string;
      } | null;
    }[];
  }) => {
    return {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        tokens: message.tokens,
        reactions: {
          liked: Boolean(message.reactions?.liked),
          disliked: Boolean(message.reactions?.disliked),
        },
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment._id ?? attachment.id,
          fileType: attachment.fileType ?? attachment.type,
          mimeType: attachment.mimeType,
          originalName: attachment.originalName ?? attachment.fileName,
          url: attachment.url,
          thumbnailUrl: attachment.thumbnailUrl,
        })),
        reference: message.reference?.kind && message.reference?.url
          ? {
              kind: message.reference.kind,
              url: message.reference.url,
              id: message.reference.id,
            }
          : undefined,
      })),
    };
  }, []);

  const applyDescriptiveAttachmentNames = useCallback((uiMessages: UiMessage[]) => {
    return uiMessages.map((message, index) => {
      if (!message.attachments?.length) return message;
      if (message.role !== 'assistant') return message;

      const previousUser = [...uiMessages.slice(0, index)]
        .reverse()
        .find((candidate) => candidate.role === 'user' && candidate.content.trim().length > 0);
      const fallbackText = message.content.trim() || previousUser?.content?.trim() || '';

      const nextAttachments = message.attachments.map((attachment) => ({
        ...attachment,
        originalName: suggestDescriptiveFileName({
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          fallbackText,
        }),
      }));

      return { ...message, attachments: nextAttachments };
    });
  }, [suggestDescriptiveFileName]);

  const handleDocumentWizardComplete = useCallback((messageId: string, documentType: string, artifacts: DocumentWizardArtifact[]) => {
    const normalizedAttachments: UiMessageAttachment[] = artifacts.map((artifact, index) => {
      const resolvedUrl = resolveBackendAssetUrl(artifact.url) ?? artifact.url;
      return {
        id: `${artifact.fileName}-${index}-${resolvedUrl}`,
        fileType: artifact.mimeType?.startsWith('image/')
          ? 'image'
          : artifact.mimeType?.startsWith('video/')
            ? 'video'
            : 'document',
        mimeType: artifact.mimeType,
        originalName: artifact.fileName,
        url: resolvedUrl,
        thumbnailUrl: artifact.mimeType?.startsWith('image/') ? resolvedUrl : undefined,
      };
    });

    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        content: documentType
          ? `Your ${documentType} is ready. Download it below.`
          : 'Your document is ready. Download it below.',
        attachments: normalizedAttachments,
        documentWizard: undefined,
      };
    }));
    autoScrollEnabledRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom();
    hapticSuccess();
  }, [resolveBackendAssetUrl]);

  const collapseAllDocumentWizards = useCallback(() => {
    setMessages((prev) => prev.map((message) => (
      message.documentWizard
        ? {
            ...message,
            documentWizard: {
              ...message.documentWizard,
              collapsed: true,
            },
          }
        : message
    )));
  }, []);

  const expandDocumentWizard = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((message) => {
      if (!message.documentWizard) return message;
      return {
        ...message,
        documentWizard: {
          ...message.documentWizard,
          collapsed: message.id === messageId ? false : true,
        },
      };
    }));
    autoScrollEnabledRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom();
  }, []);

  const hasExpandedDocumentWizard = useCallback(
    () => messages.some((message) => message.documentWizard && !message.documentWizard.collapsed),
    [messages],
  );

  const collectDocumentWizardDraftMessages = useCallback((source: UiMessage[]) => {
    const draftIds = new Set<string>();
    source.forEach((message, index) => {
      if (!message.documentWizard) return;
      draftIds.add(message.id);
      const previous = source[index - 1];
      if (previous?.role === 'user') {
        draftIds.add(previous.id);
      }
    });
    return source.filter((message) => draftIds.has(message.id));
  }, []);

  const getDocumentWizardDraftKey = useCallback((conversationId?: string | null) => (
    conversationId?.trim() ? `conversation:${conversationId.trim()}` : 'standalone'
  ), []);

  const mergeDocumentWizardDraftMessages = useCallback((baseMessages: UiMessage[], draftMessages: UiMessage[]) => {
    if (draftMessages.length === 0) return baseMessages;
    if (baseMessages.some((message) => message.documentWizard)) return baseMessages;

    const existingIds = new Set(baseMessages.map((message) => message.id));
    const createFingerprint = (message: UiMessage) => (
      [
        message.role,
        message.content.trim(),
        Math.round(message.createdAt / 1000),
        message.documentWizard?.documentType ?? '',
        message.documentWizard?.format ?? '',
      ].join('|')
    );
    const existingFingerprints = new Set(baseMessages.map(createFingerprint));
    const additions = draftMessages.filter((message) => (
      !existingIds.has(message.id) && !existingFingerprints.has(createFingerprint(message))
    ));

    if (additions.length === 0) return baseMessages;
    return [...baseMessages, ...additions].sort((left, right) => left.createdAt - right.createdAt);
  }, []);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  };

  const waitForVideoGeneration = useCallback(async (jobId: string) => {
    let lastKnownStatus: string | undefined;
    let lastKnownMessage: string | undefined;
    let lastKnownCode: string | undefined;
    for (let attempt = 0; attempt < VIDEO_JOB_POLL_ATTEMPTS; attempt += 1) {
      try {
        const status = await pollVideoJob(jobId);
        lastKnownStatus = status.status;
        lastKnownMessage = status.error || status.message || lastKnownMessage;
        lastKnownCode = (status as unknown as { code?: string; errorCode?: string })?.code
          || (status as unknown as { code?: string; errorCode?: string })?.errorCode
          || lastKnownCode;
        if (status.status === 'completed') {
          const resolvedVideoUrl = resolveBackendAssetUrl(status.result?.videoUrl ?? status.videoUrl);
          if (!resolvedVideoUrl) {
            const noUrlError = new Error('Video generation completed, but no video URL was returned.') as Error & { code?: string; status?: number };
            noUrlError.code = 'VIDEO_GENERATION_MISSING_URL';
            noUrlError.status = 200;
            throw noUrlError;
          }
          return {
            videoId: status.result?.id,
            videoPrompt: status.result?.prompt,
            videoUrl: resolvedVideoUrl,
          };
        }
        if (status.status === 'failed') {
          const failedError = new Error(status.error || status.message || 'Video generation failed.') as Error & {
            code?: string;
            status?: number;
          };
          failedError.code = lastKnownCode || 'VIDEO_GENERATION_FAILED';
          failedError.status = 200;
          throw failedError;
        }
        await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_POLL_INTERVAL_MS));
      } catch (error) {
        const typed = error as { status?: number; code?: string; message?: string } | undefined;
        const code = (typed?.code ?? '').toUpperCase();
        const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
        const isRateLimitedOrTransient =
          typed?.status === 429
          || typed?.status === 422
          || code.includes('RATE_LIMIT')
          || code.includes('UNPROCESSABLE')
          || message.includes('too many video generation requests')
          || message.includes('too many requests')
          || message.includes('still processing')
          || message.includes('not ready');
        if (!isRateLimitedOrTransient) throw error;
        await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_RATE_LIMIT_BACKOFF_MS));
      }
    }

    const timeoutError = new Error(
      lastKnownStatus === 'failed'
        ? (lastKnownMessage || 'Video generation failed.')
        : 'Video generation timed out. Please try again.',
    ) as Error & { code?: string; status?: number };
    timeoutError.code = lastKnownStatus === 'failed'
      ? (lastKnownCode || 'VIDEO_GENERATION_FAILED')
      : 'VIDEO_GENERATION_TIMEOUT';
    timeoutError.status = 200;
    throw timeoutError;
  }, [resolveBackendAssetUrl]);

  const artifactHydrationInFlightRef = useRef<Set<string>>(new Set());
  const hydrateAssistantAttachmentsFromArtifacts = useCallback(async (conversationId: string) => {
    if (!conversationId || artifactHydrationInFlightRef.current.has(conversationId)) return;
    artifactHydrationInFlightRef.current.add(conversationId);

    try {
      const collected: Awaited<ReturnType<typeof getArtifactsPage>>['artifacts'] = [];
      let page = 1;
      let pages = 1;
      do {
        const payload = await getArtifactsPage({ page, limit: 100 });
        collected.push(...payload.artifacts);
        pages = payload.pagination.pages;
        page += 1;
      } while (page <= pages && page <= 10);

      const byMessageId = new Map<string, UiMessageAttachment[]>();
      for (const artifact of collected) {
        if (artifact.conversationId !== conversationId) continue;
        if (!artifact.messageId) continue;
        const artifactUrl = artifact.url ?? artifact.downloadUrl;
        if (!artifactUrl) continue;

        const mimeType = artifact.mimeType;
        const normalizedUrl = resolveBackendAssetUrl(artifactUrl) ?? artifactUrl;
        const fileType = (mimeType ?? '').startsWith('image/')
          ? 'image'
          : (mimeType ?? '').startsWith('video/')
            ? 'video'
            : (artifact.kind || 'file');
        const attachment: UiMessageAttachment = {
          id: artifact.artifactId || artifact.url,
          fileType,
          mimeType,
          originalName: artifact.fileName,
          url: normalizedUrl,
          thumbnailUrl: (mimeType ?? '').startsWith('image/') ? normalizedUrl : undefined,
        };
        const existing = byMessageId.get(artifact.messageId) ?? [];
        existing.push(attachment);
        byMessageId.set(artifact.messageId, existing);
      }

      if (!byMessageId.size) return;

      setMessages((prev) => {
        let changed = false;
        const next = prev.map((message) => {
          if (message.role !== 'assistant') return message;
          if ((message.attachments?.length ?? 0) > 0) return message;
          const attachments = byMessageId.get(message.id);
          if (!attachments?.length) return message;
          changed = true;
          return {
            ...message,
            attachments,
          };
        });
        return changed ? applyDescriptiveAttachmentNames(next) : prev;
      });
    } catch {
      // Best-effort hydration from artifacts endpoint.
    } finally {
      artifactHydrationInFlightRef.current.delete(conversationId);
    }
  }, [applyDescriptiveAttachmentNames, resolveBackendAssetUrl]);

  const applyAuthConversationDetail = useCallback((detail: Awaited<ReturnType<typeof getAuthenticatedConversation>>) => {
    const routedConversationId = routedConversationIdRef.current;
    if (routedConversationId && detail.id !== routedConversationId) return;
    const mapped = detail.messages.map(mapAuthMessageToUiMessage);
    setMessages((prev) => {
      const previousById = new Map(prev.map((message) => [message.id, message] as const));
      const merged = mapped.map((message) => {
        if (message.role !== 'assistant') return message;
        const prior = previousById.get(message.id);
        if (!prior) {
          if (message.content.trim().length > 0) return message;
          const latestLocalAssistantWithText = [...prev]
            .reverse()
            .find((item) => item.role === 'assistant' && item.content.trim().length > 0);
          if (!latestLocalAssistantWithText) return message;
          return {
            ...message,
            content: latestLocalAssistantWithText.content,
            attachments: (message.attachments?.length ?? 0) > 0 ? message.attachments : latestLocalAssistantWithText.attachments,
            imageUrl: message.imageUrl ?? latestLocalAssistantWithText.imageUrl,
            imagePrompt: message.imagePrompt ?? latestLocalAssistantWithText.imagePrompt,
            imageId: message.imageId ?? latestLocalAssistantWithText.imageId,
            videoUrl: message.videoUrl ?? latestLocalAssistantWithText.videoUrl,
            videoPrompt: message.videoPrompt ?? latestLocalAssistantWithText.videoPrompt,
            videoId: message.videoId ?? latestLocalAssistantWithText.videoId,
          };
        }

        const serverContent = message.content.trim();
        const priorContent = prior.content.trim();
        const mergedContent = serverContent.length > 0 ? message.content : (priorContent.length > 0 ? prior.content : message.content);
        const shouldPreservePriorMedia =
          (message.attachments?.length ?? 0) === 0
          && (prior.attachments?.length ?? 0) > 0;

        return {
          ...message,
          content: mergedContent,
          attachments: shouldPreservePriorMedia ? prior.attachments : message.attachments,
          imageUrl: message.imageUrl ?? prior.imageUrl,
          imagePrompt: message.imagePrompt ?? prior.imagePrompt,
          imageId: message.imageId ?? prior.imageId,
          videoUrl: message.videoUrl ?? prior.videoUrl,
          videoPrompt: message.videoPrompt ?? prior.videoPrompt,
          videoId: message.videoId ?? prior.videoId,
        };
      });
      const mappedIds = new Set(merged.map((message) => message.id));
      const endsWithUser = merged.length > 0 && merged[merged.length - 1]?.role === 'user';
      const lastMappedUserCreatedAt = [...merged]
        .reverse()
        .find((message) => message.role === 'user')?.createdAt ?? 0;
      const localAssistantFallback = endsWithUser
        ? [...prev]
          .reverse()
          .find((message) => (
            message.role === 'assistant'
            && !mappedIds.has(message.id)
            && (message.content.trim().length > 0 || message.isImageGenerating || message.isVideoGenerating || message.isArtifactGenerating)
            && message.createdAt >= lastMappedUserCreatedAt
          ))
        : null;

      const next = localAssistantFallback ? [...merged, localAssistantFallback] : merged;
      const preservedDrafts = collectDocumentWizardDraftMessages(prev);
      return applyDescriptiveAttachmentNames(mergeDocumentWizardDraftMessages(next, preservedDrafts));
    });
    setMessageReactions(() =>
      detail.messages.reduce<Record<string, 'like' | 'dislike' | undefined>>((acc, message) => {
        if (message.role !== 'assistant') return acc;
        acc[message.id] = message.reactions?.liked
          ? 'like'
          : message.reactions?.disliked
            ? 'dislike'
            : undefined;
        return acc;
      }, {}),
    );
    void hydrateAssistantAttachmentsFromArtifacts(detail.id);
  }, [
    applyDescriptiveAttachmentNames,
    collectDocumentWizardDraftMessages,
    hydrateAssistantAttachmentsFromArtifacts,
    mapAuthMessageToUiMessage,
    mergeDocumentWizardDraftMessages,
  ]);

  const applyDedicatedMediaConversation = useCallback((conversationPage: Awaited<ReturnType<typeof getDedicatedMediaConversation>>) => {
    setAuthConversationId(conversationPage.conversation.id);
    applyAuthConversationDetail(mapDedicatedMediaConversationToAuthDetail(conversationPage.conversation));
  }, [applyAuthConversationDetail, mapDedicatedMediaConversationToAuthDetail]);

  const syncAssistantMessageAfterStream = useCallback(async (
    conversationId: string,
    assistantMessageId: string,
    localFallbackId: string,
    fallbackAttachments: UiMessageAttachment[] = [],
  ) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const detail = await getAuthenticatedConversation(conversationId, { force: true });
        const serverMessage = detail.messages.find(
          (message) => message.id === assistantMessageId && message.role === 'assistant',
        );

        if (serverMessage) {
          const mapped = mapAuthMessageToUiMessage(serverMessage);
          const mergedMapped = (mapped.attachments?.length ?? 0) > 0
            ? mapped
            : { ...mapped, attachments: fallbackAttachments };
          setMessages((prev) => {
            const previousUser = [...prev]
              .reverse()
              .find((candidate) => candidate.role === 'user' && candidate.content.trim().length > 0);
            const fallbackText = mergedMapped.content.trim() || previousUser?.content?.trim() || '';
            const enhancedMapped = mergedMapped.attachments?.length
              ? {
                  ...mergedMapped,
                  attachments: mergedMapped.attachments.map((attachment) => ({
                    ...attachment,
                    originalName: suggestDescriptiveFileName({
                      originalName: attachment.originalName,
                      mimeType: attachment.mimeType,
                      fallbackText,
                    }),
                  })),
                }
              : mapped;
            const byServerId = prev.findIndex((item) => item.id === assistantMessageId);
            if (byServerId >= 0) {
              const next = [...prev];
              next[byServerId] = enhancedMapped;
              return next;
            }

            const byFallbackId = prev.findIndex((item) => item.id === localFallbackId);
            if (byFallbackId >= 0) {
              const next = [...prev];
              next[byFallbackId] = enhancedMapped;
              return next;
            }

            return prev;
          });

          const hasVisualOrFileState = Boolean(
            mergedMapped.imageUrl
            || mergedMapped.videoUrl
            || (mergedMapped.attachments?.length ?? 0) > 0,
          );
          if (hasVisualOrFileState) return;
        }
      } catch {
        // Best-effort sync; keep the streamed state if server sync fails.
      }

      await new Promise((resolve) => setTimeout(resolve, 220));
    }
  }, [mapAuthMessageToUiMessage, suggestDescriptiveFileName]);

  const reconcileAuthConversationAfterSend = useCallback(async (conversationId: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const detail = await getAuthenticatedConversation(conversationId, { force: true });
        if (detail.messages.length > 0) {
          applyAuthConversationDetail(detail);
          return;
        }
      } catch {
        // retry until attempts exhausted
      }
      await new Promise((resolve) => setTimeout(resolve, 240));
    }
  }, [applyAuthConversationDetail]);

  const hydrateDedicatedMediaConversation = useCallback(async (
    screen: DedicatedMediaScreen,
    options?: { attempts?: number; delayMs?: number; preserveOnUnavailable?: boolean },
  ) => {
    const attempts = options?.attempts ?? 1;
    const delayMs = options?.delayMs ?? 300;
    const preserveOnUnavailable = options?.preserveOnUnavailable ?? false;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const conversationPage = await getDedicatedMediaConversation(screen, { limit: 20 });
        applyDedicatedMediaConversation(conversationPage);
        return true;
      } catch (error) {
        if (isDedicatedMediaConversationUnavailable(error)) {
          if (!preserveOnUnavailable) {
            setAuthConversationId(null);
            setMessages([createWelcomeMessage()]);
            setMessageReactions({});
          }
          return false;
        }
        if (attempt === attempts - 1) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return false;
  }, [applyDedicatedMediaConversation, createWelcomeMessage]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAssetAccessToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!cancelled) {
        setAssetAccessToken(token ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const targetMessageId = typeof params.messageId === 'string' ? params.messageId : '';
    if (!targetConversationId || !targetMessageId) return;

    const inActiveConversation =
      (isAuthenticated && authConversationId === targetConversationId)
      || (!isAuthenticated && guestConversationId === targetConversationId);
    if (!inActiveConversation) return;

    const messageIndex = messages.findIndex((message) => message.id === targetMessageId);
    if (messageIndex < 0) return;

    const jumpKey = `${targetConversationId}:${targetMessageId}`;
    if (lastJumpedMessageKeyRef.current === jumpKey) return;
    lastJumpedMessageKeyRef.current = jumpKey;

    requestAnimationFrame(() => {
      try {
        messagesListRef.current?.scrollToIndex({ index: messageIndex, animated: true, viewPosition: 0.45 });
      } catch {
        messagesListRef.current?.scrollToOffset({ offset: Math.max(0, messageIndex * 120), animated: true });
      }
      setHighlightedMessageId(targetMessageId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === targetMessageId ? null : current));
        highlightTimeoutRef.current = null;
      }, 2200);
      router.setParams({ messageId: undefined });
    });
  }, [authConversationId, guestConversationId, isAuthenticated, messages, params.conversationId, params.messageId]);

  const scheduleVideoAutoSync = useCallback((conversationId: string, expectedPrompt: string, startedAt: number) => {
    if (videoAutoSyncInFlightRef.current) return;
    videoAutoSyncInFlightRef.current = true;
    const normalizedPrompt = expectedPrompt.trim().toLowerCase();

    const run = async () => {
      for (let attempt = 0; attempt < VIDEO_AUTO_SYNC_ATTEMPTS; attempt += 1) {
        try {
          const detail = await getAuthenticatedConversation(conversationId, { force: true });
          applyAuthConversationDetail(detail);
          const hasResolvedVideo = detail.messages.some((message) => {
            if (message.role !== 'assistant' || !message.videoUrl) return false;
            const createdAt = new Date(message.createdAt).getTime();
            const candidate = (message.videoPrompt ?? message.content ?? '').trim().toLowerCase();
            if (candidate && candidate === normalizedPrompt) return true;
            return createdAt >= startedAt - 15000;
          });
          if (hasResolvedVideo) {
            videoAutoSyncInFlightRef.current = false;
            return;
          }
        } catch {
          // Keep trying; background sync is best-effort.
        }
        await new Promise((resolve) => setTimeout(resolve, VIDEO_AUTO_SYNC_INTERVAL_MS));
      }
      videoAutoSyncInFlightRef.current = false;
    };

    void run();
  }, [applyAuthConversationDetail]);

  const isLimitOrUpgradeError = (error: unknown) => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
    const isModelUnavailableUpgrade = code === 'UPGRADE_REQUIRED' && message.includes('not available on your current plan');
    const isUsageLimitMessage =
      message.includes('monthly limit')
      || message.includes('daily limit')
      || message.includes('usage limit')
      || message.includes('quota')
      || message.includes('upgrade your plan')
      || message.includes('upgrade required');
    if (isModelUnavailableUpgrade) return false;
    if (
      code.endsWith('_LIMIT_EXCEEDED')
      || code === 'LIMIT_EXCEEDED'
      || code === 'DAILY_LIMIT_EXCEEDED'
      || code === 'GUEST_DAILY_LIMIT_EXCEEDED'
      || code === 'UPGRADE_REQUIRED'
      || isUsageLimitMessage
    ) {
      return true;
    }
    if (typed?.status === 429 || code.includes('RATE_LIMIT')) {
      return false;
    }
    return message.includes('limit') || message.includes('quota') || message.includes('upgrade required');
  };

  const isRateLimitedError = (error: unknown) => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
    if (isLimitOrUpgradeError(error)) return false;
    return typed?.status === 429 || code.includes('RATE_LIMIT') || message.includes('too many');
  };

  const getLimitNoticeMessage = useCallback((kind: 'chat' | 'image' | 'video') => {
    if (kind === 'image') return t('chat.limit.imageReached');
    if (kind === 'video') return t('chat.limit.videoReached');
    return t('chat.limit.chatReached');
  }, [t]);

  const getLimitKind = (error: unknown, fallback: 'chat' | 'image' | 'video') => {
    const typed = error as { code?: string; message?: string } | undefined;
    const signal = `${typed?.code ?? ''} ${typed?.message ?? (error instanceof Error ? error.message : '')}`.toLowerCase();
    if (signal.includes('video')) return 'video';
    if (signal.includes('image')) return 'image';
    if (signal.includes('chat') || signal.includes('text') || signal.includes('message')) return 'chat';
    return fallback;
  };

  const getLimitResetHours = (error: unknown) => {
    const message = (error as { message?: string } | undefined)?.message
      ?? (error instanceof Error ? error.message : '');
    const match = message.match(/resets?\s+in\s+(\d+(?:\.\d+)?)\s*hours?/i);
    if (!match) return null;
    const hours = Number(match[1]);
    return Number.isFinite(hours) && hours >= 0 ? hours : null;
  };

  const formatLimitResetDuration = (hours: number) => {
    if (hours < 1) return 'less than an hour';
    const totalHours = Math.ceil(hours);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    if (days === 0) return `${totalHours} hour${totalHours === 1 ? '' : 's'}`;
    const dayPart = `${days} day${days === 1 ? '' : 's'}`;
    if (remainingHours === 0) return dayPart;
    return `${dayPart} and ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
  };

  const formatTierLabel = useCallback((tier: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max') => {
    if (tier === 'cafa_smart') return 'Cafa Smart';
    if (tier === 'cafa_pro') return 'Cafa Pro';
    if (tier === 'cafa_max') return 'Cafa Max';
    return 'Free';
  }, []);

  const showLimitNotice = useCallback((kind: 'chat' | 'image' | 'video', resetHours?: number | null) => {
    setUpgradeNoticeKind(kind);
    setUpgradeNoticeResetHours(resetHours ?? null);
    setStatusNotice(getLimitNoticeMessage(kind));
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = null;
  }, [getLimitNoticeMessage]);

  const restorePurchasesAndSyncFromLimitNotice = useCallback(async () => {
    if (Platform.OS !== 'ios' || !isAuthenticated || isLimitRestoreSyncing) return;

    setIsLimitRestoreSyncing(true);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setStatusNotice(t('plans.syncingSubscription'));

    try {
      await restorePurchases();
      await refreshCustomerInfo();
      const synced = await syncSubscriptionState().catch(() => null);
      if (synced?.tier && synced.tier !== 'free') {
        setAuthSubscriptionTier(synced.tier);
      }
      const timeoutAt = Date.now() + LIMIT_RESTORE_SYNC_TIMEOUT_MS;
      let resolvedTier: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max' = 'free';
      while (Date.now() < timeoutAt) {
        try {
          const latest = await getSubscriptionOverview({ force: true });
          const latestTier = latest.subscription.tier;
          const latestStatus = latest.subscription.status;
          const isUsablePaidTier =
            latestTier !== 'free'
            && (latestStatus === 'active' || latestStatus === 'trialing' || latestStatus === 'past_due');
          if (isUsablePaidTier) {
            resolvedTier = latestTier;
            break;
          }
        } catch {
          // Keep polling until timeout.
        }
        await new Promise((resolve) => setTimeout(resolve, LIMIT_RESTORE_SYNC_POLL_MS));
      }

      await refreshAuthUser().catch(() => {});
      if (resolvedTier !== 'free') {
        setAuthSubscriptionTier(resolvedTier);
        setStatusNotice(t('plans.upgradeVerified', { plan: formatTierLabel(resolvedTier) }));
        setUpgradeNoticeKind(null);
        setUpgradeNoticeResetHours(null);
        hapticSuccess();
      } else {
        setStatusNotice(t('plans.upgradeSyncPending'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('plans.portalError');
      setStatusNotice(message);
      hapticError();
    } finally {
      setIsLimitRestoreSyncing(false);
    }
  }, [
    formatTierLabel,
    isAuthenticated,
    isLimitRestoreSyncing,
    refreshAuthUser,
    refreshCustomerInfo,
    restorePurchases,
    setAuthSubscriptionTier,
    t,
  ]);

  const getFriendlyErrorMessage = useCallback((error: unknown, kind: 'chat' | 'image' | 'video' = 'chat') => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const rawMessage = typed?.message ?? (error instanceof Error ? error.message : '');
    const message = rawMessage.toLowerCase();
    const isModelUnavailableUpgrade = code === 'UPGRADE_REQUIRED' && message.includes('not available on your current plan');

    if (isModelUnavailableUpgrade) {
      if (message.includes('gpt-4o-mini')) return 'Cafa Smart is not available on your current plan.';
      if (message.includes('gpt-4o')) return 'Cafa Ultra is not available on your current plan.';
      return 'This model is not available on your current plan.';
    }

    if (code.endsWith('_LIMIT_EXCEEDED') || code === 'LIMIT_EXCEEDED') {
      return getLimitNoticeMessage(kind);
    }

    if (typed?.status === 429 || code.includes('RATE_LIMIT')) {
      return 'Too many requests right now. Please wait a moment and try again.';
    }

    if (isLimitOrUpgradeError(error)) {
      return getLimitNoticeMessage(kind);
    }
    if (code === 'GUEST_ENDPOINT_UNAVAILABLE' || message.includes('guest mode is unavailable on this backend')) {
      return 'Guest mode is currently unavailable. Please try again later or sign in.';
    }
    if (code === 'GUEST_NETWORK_ERROR') {
      return rawMessage || 'Guest mode could not reach the server. Check your connection and try again.';
    }
    if (typed?.status === 401 || code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED') {
      return 'Your session expired. Please sign in again.';
    }
    if (code === 'VIDEO_FROM_IMAGE_FILE_MISSING' || code === 'VIDEO_FROM_IMAGE_FILE_UNREADABLE') {
      return 'The selected image is no longer available. Please reselect the image and try again.';
    }
    if (code === 'VIDEO_FROM_IMAGE_INVALID_URI') {
      return 'Could not read the selected image. Please choose the image again and retry.';
    }
    if (code === 'VIDEO_FROM_IMAGE_NETWORK_ERROR' || code === 'NETWORK_ERROR') {
      return 'Upload failed before reaching the server. Check connection and try again.';
    }
    if (typed?.status === 403 || code === 'FORBIDDEN' || code === 'UPGRADE_REQUIRED' || message === 'forbidden') {
      return 'You do not have permission for this action on your current plan.';
    }
    if (
      code === 'USAGE_LIMIT_EXCEEDED'
      || code === 'DAILY_LIMIT_EXCEEDED'
      || code === 'GUEST_DAILY_LIMIT_EXCEEDED'
    ) {
      return getLimitNoticeMessage(kind);
    }
    if (typed?.status === 500 || typed?.status === 502 || typed?.status === 503 || typed?.status === 504) {
      return 'Something went wrong on our server. Please try again in a moment.';
    }
    if (message.includes('internal server error')) {
      return 'Something went wrong on our server. Please try again in a moment.';
    }
    if (typed?.status === 404 || code === 'NOT_FOUND') {
      return 'This feature is currently unavailable.';
    }
    return rawMessage || t('chat.sendFailed');
  }, [getLimitNoticeMessage, t]);

  useEffect(() => {
    if (isAuthenticated) return;
    setStatusNotice('');
    setUpgradeNoticeKind(null);
    setUpgradeNoticeResetHours(null);
    setIsLimitRestoreSyncing(false);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setGuestUpsellVisible(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_UPSELL_STATE_KEY);
        const now = Date.now();
        if (!raw) {
          guestUpsellStateRef.current = { windowStartedAt: now, responseCount: 0, shown: false };
          return;
        }
        const parsed = JSON.parse(raw) as Partial<{ windowStartedAt: number; responseCount: number; shown: boolean }>;
        const windowStartedAt = typeof parsed.windowStartedAt === 'number' ? parsed.windowStartedAt : 0;
        const responseCount = typeof parsed.responseCount === 'number' ? parsed.responseCount : 0;
        const shown = parsed.shown === true;
        const isExpired = windowStartedAt <= 0 || now - windowStartedAt >= GUEST_UPSELL_WINDOW_MS;
        const nextState = isExpired
          ? { windowStartedAt: now, responseCount: 0, shown: false }
          : { windowStartedAt, responseCount, shown };
        if (!cancelled) {
          guestUpsellStateRef.current = nextState;
        }
      } catch {
        if (!cancelled) {
          guestUpsellStateRef.current = { windowStartedAt: Date.now(), responseCount: 0, shown: false };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [GUEST_UPSELL_STATE_KEY, GUEST_UPSELL_WINDOW_MS, isAuthenticated]);

  const renderInlineMarkdown = useCallback((
    content: string,
    options?: { textColor?: string; isCode?: boolean },
  ) => {
    const textColor = options?.textColor ?? colors.textPrimary;
    const isCode = options?.isCode ?? false;
    const linkColor = isDark ? '#8FD3FF' : '#0E5DA8';
    const linkBackgroundColor = isDark ? 'rgba(143, 211, 255, 0.14)' : 'rgba(14, 93, 168, 0.10)';
    if (
      isCode
      || (
        !content.includes('**')
        && !content.includes('*')
        && !content.includes('`')
        && !content.includes('](')
      )
    ) {
      return content;
    }

    const result: ReactNode[] = [];
    const pattern = /(\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let matchIndex = 0;
    let match = pattern.exec(content);

    while (match) {
      if (match.index > lastIndex) {
        result.push(content.slice(lastIndex, match.index));
      }

      const token = match[0];
      if (token.startsWith('[')) {
        const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
        if (linkMatch) {
          const [, label, url] = linkMatch;
          result.push(
            <Text
              key={`md-link-${matchIndex}`}
              onPress={() => {
                void openInAppBrowser(url);
              }}
              suppressHighlighting
              style={{
                color: linkColor,
                fontWeight: '700',
                backgroundColor: linkBackgroundColor,
                paddingHorizontal: 4,
                paddingVertical: 1,
                borderRadius: 6,
              }}
            >
              {label}
            </Text>,
          );
        } else {
          result.push(token);
        }
      } else if (token.startsWith('`') && token.endsWith('`')) {
        result.push(
          <Text
            key={`md-code-${matchIndex}`}
            style={{
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              backgroundColor: isDark ? '#1A1A1F' : '#ECECF4',
              color: textColor,
              paddingHorizontal: 4,
              borderRadius: 4,
            }}
          >
            {token.slice(1, -1)}
          </Text>,
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        result.push(
          <Text key={`md-bold-${matchIndex}`} style={{ fontWeight: '700', color: textColor }}>
            {token.slice(2, -2)}
          </Text>,
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        result.push(
          <Text key={`md-italic-${matchIndex}`} style={{ fontStyle: 'italic', color: textColor }}>
            {token.slice(1, -1)}
          </Text>,
        );
      } else {
        result.push(token);
      }

      lastIndex = match.index + match[0].length;
      matchIndex += 1;
      match = pattern.exec(content);
    }

    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result.length ? result : content;
  }, [colors.textPrimary, isDark, openInAppBrowser]);

  type PrismTokenNode = string | {
    type: string;
    content: PrismTokenNode | PrismTokenNode[];
    alias?: string | string[];
  };

  const getCodeTokenColor = useCallback((tokenType: string) => {
    const darkPalette: Record<string, string> = {
      comment: '#6A9955',
      prolog: '#6A9955',
      doctype: '#6A9955',
      cdata: '#6A9955',
      punctuation: '#D4D4D4',
      operator: '#D4D4D4',
      entity: '#D4D4D4',
      keyword: '#569CD6',
      builtin: '#4EC9B0',
      function: '#DCDCAA',
      className: '#4EC9B0',
      class: '#4EC9B0',
      variable: '#9CDCFE',
      property: '#9CDCFE',
      constant: '#4FC1FF',
      string: '#CE9178',
      char: '#CE9178',
      number: '#B5CEA8',
      boolean: '#569CD6',
      regex: '#D16969',
      symbol: '#D7BA7D',
      tag: '#569CD6',
      attrName: '#9CDCFE',
      attrValue: '#CE9178',
    };

    const lightPalette: Record<string, string> = {
      comment: '#008000',
      prolog: '#008000',
      doctype: '#008000',
      cdata: '#008000',
      punctuation: '#24292F',
      operator: '#24292F',
      entity: '#24292F',
      keyword: '#0000FF',
      builtin: '#267F99',
      function: '#795E26',
      className: '#267F99',
      class: '#267F99',
      variable: '#001080',
      property: '#001080',
      constant: '#0070C1',
      string: '#A31515',
      char: '#A31515',
      number: '#098658',
      boolean: '#0000FF',
      regex: '#811F3F',
      symbol: '#795E26',
      tag: '#800000',
      attrName: '#FF0000',
      attrValue: '#0451A5',
    };

    const palette = isDark ? darkPalette : lightPalette;
    return palette[tokenType] ?? (isDark ? '#D4D4D4' : '#24292F');
  }, [isDark]);

  const renderCodeTokens = useCallback((tokens: PrismTokenNode[], pathPrefix: string): ReactNode[] =>
    tokens.map((token, index) => {
      if (typeof token === 'string') return token;

      const aliasList = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
      const tokenTypes = [token.type, ...aliasList].flatMap((rawType) => {
        const normalized = rawType.replace(/-([a-z])/g, (_, chr: string) => chr.toUpperCase());
        return normalized === rawType ? [rawType] : [rawType, normalized];
      });
      const color = tokenTypes.map((type) => getCodeTokenColor(type)).find(Boolean) ?? (isDark ? '#D4D4D4' : '#24292F');
      const childPath = `${pathPrefix}-${index}`;
      const childContent = Array.isArray(token.content)
        ? renderCodeTokens(token.content, childPath)
        : typeof token.content === 'string'
          ? token.content
          : renderCodeTokens([token.content], childPath);

      return (
        <Text key={childPath} style={{ color }}>
          {childContent}
        </Text>
      );
    }), [getCodeTokenColor, isDark]);

  const renderHighlightedCode = useCallback((code: string, language: string) => {
    if (!code) return code;
    if (language === 'text') return code;

    try {
      const grammar = Prism.languages[language as keyof typeof Prism.languages];
      if (!grammar) return code;
      const tokens = Prism.tokenize(code, grammar) as PrismTokenNode[];
      return renderCodeTokens(tokens, `code-${language}`);
    } catch {
      return code;
    }
  }, [renderCodeTokens]);

  const normalizeAssistantSearchResponse = useCallback((content: string) => {
    if (!content.includes('](')) return content;

    const normalizedNewlines = content.replace(/\r\n/g, '\n');
    const sourceSectionMatch = /\nSources:\n([\s\S]+)$/i.exec(normalizedNewlines);
    const sourceLines = sourceSectionMatch?.[1]
      ?.split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /^\d+\.\s+\[.+\]\(https?:\/\/.+\)$/.test(line)) ?? [];

    const bodyWithoutSources = sourceSectionMatch
      ? normalizedNewlines.slice(0, sourceSectionMatch.index).trim()
      : normalizedNewlines.trim();

    const compactBody = bodyWithoutSources
      .split('\n')
      .filter((line, index, lines) => {
        const trimmed = line.trim();
        const isStandaloneLink = /^\[.+\]\(https?:\/\/.+\)$/.test(trimmed);
        if (!isStandaloneLink) return true;
        const nextNonEmpty = lines.slice(index + 1).find((candidate) => candidate.trim().length > 0)?.trim() ?? '';
        return !nextNonEmpty.startsWith('**');
      })
      .map((line) => line.replace(/\(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\)/g, 'Source: [$1]($2)'))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!sourceLines.length) {
      return compactBody;
    }

    const compactSources = sourceLines.map((line, index) => {
      const match = /^\d+\.\s+\[([^\]]+)\]\((https?:\/\/.+)\)$/.exec(line);
      if (!match) return line;
      const [, label, url] = match;
      return `${index + 1}. [${label}](${url})`;
    });

    return `${compactBody}\n\n**Sources**\n${compactSources.join('\n')}`;
  }, []);

  const normalizeCodeLanguage = useCallback((rawLanguage?: string) => {
    const language = (rawLanguage ?? '').trim().toLowerCase();
    if (!language) return 'text';

    const aliases: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      rb: 'ruby',
      sh: 'bash',
      zsh: 'bash',
      shell: 'bash',
      yml: 'yaml',
      md: 'markdown',
      csharp: 'cs',
      plaintext: 'text',
      txt: 'text',
    };

    return aliases[language] ?? language;
  }, []);

  const renderMessageMarkdown = useCallback((content: string, isUser: boolean) => {
    const textColor = isUser ? '#FFFFFF' : colors.textPrimary;
    if (isUser) {
      return (
        <Text style={{ color: textColor, lineHeight: 20 }}>
          {content}
        </Text>
      );
    }

    const normalized = normalizeAssistantSearchResponse(content).replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const nodes: ReactNode[] = [];
    let paragraphBuffer: string[] = [];
    let inCodeFence = false;
    let codeFenceLines: string[] = [];
    let codeFenceLanguage = 'text';
    let key = 0;

    const flushParagraph = () => {
      if (!paragraphBuffer.length) return;
      const paragraph = paragraphBuffer.join('\n');
      nodes.push(
        <Text key={`p-${key}`} selectable style={{ color: textColor, lineHeight: 20 }}>
          {renderInlineMarkdown(paragraph, { textColor })}
        </Text>,
      );
      key += 1;
      paragraphBuffer = [];
    };

    const flushCodeFence = () => {
      if (!codeFenceLines.length) return;
      const codeText = codeFenceLines.join('\n');
      const codeBlockId = `code-${key}`;
      const displayLanguage = codeFenceLanguage === 'text' ? 'Code' : codeFenceLanguage.toUpperCase();
      nodes.push(
        <View
          key={codeBlockId}
          className="rounded-xl"
          style={{
            marginBottom: 8,
            backgroundColor: isDark ? '#0E0E12' : '#ECECF4',
            borderWidth: 1,
            borderColor: isDark ? '#23232B' : '#D7D9E2',
            overflow: 'hidden',
          }}
        >
          <View
            className="flex-row items-center justify-between px-3 py-2"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: isDark ? '#23232B' : '#D7D9E2',
              backgroundColor: isDark ? '#11151E' : '#E6EBF5',
            }}
          >
            <Text style={{ color: isDark ? '#B7C0D1' : '#3A4864', fontSize: 12, fontWeight: '700' }}>
              {displayLanguage}
            </Text>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(codeText);
                hapticSuccess();
                setCopiedCodeBlockId(codeBlockId);
                if (codeCopyTimeoutRef.current) clearTimeout(codeCopyTimeoutRef.current);
                codeCopyTimeoutRef.current = setTimeout(() => {
                  setCopiedCodeBlockId((previous) => (previous === codeBlockId ? null : previous));
                  codeCopyTimeoutRef.current = null;
                }, 1300);
              }}
              hitSlop={8}
              className="rounded-md px-2 py-1"
              style={{ backgroundColor: isDark ? '#1C2331' : '#D7E2F5' }}
            >
              <Text style={{ color: isDark ? '#D8E2F7' : '#29406A', fontSize: 12, fontWeight: '700' }}>
                {copiedCodeBlockId === codeBlockId ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="px-3 py-2" style={{ minWidth: '100%' }}>
              <Text
                selectable
                style={{
                  color: isDark ? '#D4D4D4' : '#24292F',
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 13,
                  lineHeight: 20,
                }}
              >
                {renderHighlightedCode(codeText, codeFenceLanguage)}
              </Text>
            </View>
          </ScrollView>
        </View>,
      );
      key += 1;
      codeFenceLines = [];
      codeFenceLanguage = 'text';
    };

    for (const rawLine of lines) {
      const line = rawLine;

      const fenceMatch = /^```([\w#+.-]+)?\s*$/.exec(line.trim());
      if (fenceMatch) {
        flushParagraph();
        if (!inCodeFence) {
          inCodeFence = true;
          codeFenceLines = [];
          codeFenceLanguage = normalizeCodeLanguage(fenceMatch[1]);
        } else {
          inCodeFence = false;
          flushCodeFence();
        }
        continue;
      }

      if (inCodeFence) {
        codeFenceLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        continue;
      }

      const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
      if (headingMatch) {
        flushParagraph();
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        nodes.push(
          <Text
            key={`h-${key}`}
            selectable
            style={{
              color: textColor,
              fontWeight: '800',
              fontSize: level === 1 ? 18 : level === 2 ? 16 : 15,
              lineHeight: level === 1 ? 24 : 22,
              marginBottom: 6,
              marginTop: key === 0 ? 0 : 2,
            }}
          >
            {renderInlineMarkdown(headingText, { textColor })}
          </Text>,
        );
        key += 1;
        continue;
      }

      const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
      if (bulletMatch) {
        flushParagraph();
        nodes.push(
          <View key={`ul-${key}`} className="flex-row" style={{ marginBottom: 4 }}>
            <Text selectable style={{ color: textColor, lineHeight: 20 }}>{'\u2022 '}</Text>
            <Text selectable style={{ color: textColor, lineHeight: 20, flex: 1 }}>
              {renderInlineMarkdown(bulletMatch[1], { textColor })}
            </Text>
          </View>,
        );
        key += 1;
        continue;
      }

      const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
      if (orderedMatch) {
        flushParagraph();
        nodes.push(
          <View key={`ol-${key}`} className="flex-row" style={{ marginBottom: 4 }}>
            <Text selectable style={{ color: textColor, lineHeight: 20 }}>{`${orderedMatch[1]}. `}</Text>
            <Text selectable style={{ color: textColor, lineHeight: 20, flex: 1 }}>
              {renderInlineMarkdown(orderedMatch[2], { textColor })}
            </Text>
          </View>,
        );
        key += 1;
        continue;
      }

      const quoteMatch = /^>\s?(.+)$/.exec(line);
      if (quoteMatch) {
        flushParagraph();
        nodes.push(
          <View
            key={`q-${key}`}
            className="rounded-r-lg px-2 py-1"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: isUser ? 'rgba(255,255,255,0.65)' : colors.primary,
              marginBottom: 6,
              backgroundColor: isDark ? '#121218' : '#F0F2F8',
            }}
          >
            <Text selectable style={{ color: textColor, lineHeight: 20 }}>
              {renderInlineMarkdown(quoteMatch[1], { textColor })}
            </Text>
          </View>,
        );
        key += 1;
        continue;
      }

      paragraphBuffer.push(line);
    }

    flushParagraph();
    if (inCodeFence) {
      flushCodeFence();
    }

    if (!nodes.length) {
      return (
        <Text selectable style={{ color: textColor, lineHeight: 20 }}>
          {normalizeAssistantSearchResponse(content)}
        </Text>
      );
    }
    return nodes;
  }, [colors.primary, colors.textPrimary, copiedCodeBlockId, isDark, normalizeAssistantSearchResponse, normalizeCodeLanguage, renderHighlightedCode, renderInlineMarkdown]);

  const showTooltip = (text: string, event?: GestureResponderEvent) => {
    hapticSelection();
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const fallbackX = screenWidth / 2;
    const fallbackY = Dimensions.get('window').height - 180;
    const pageX = event?.nativeEvent?.pageX ?? fallbackX;
    const pageY = event?.nativeEvent?.pageY ?? fallbackY;

    setTooltipState({ text, x: pageX, y: pageY });
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipState(null);
      tooltipTimeoutRef.current = null;
    }, 1200);
  };

  const showDownloadToast = useCallback((message: string, durationMs: number | null = 2400) => {
    setDownloadToastNotice(message);
    if (downloadToastTimeoutRef.current) clearTimeout(downloadToastTimeoutRef.current);
    if (durationMs === null) {
      downloadToastTimeoutRef.current = null;
      return;
    }
    downloadToastTimeoutRef.current = setTimeout(() => {
      setDownloadToastNotice('');
      downloadToastTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const showTtsToast = useCallback((message: string) => {
    setTtsToastNotice(message);
    if (ttsToastTimeoutRef.current) clearTimeout(ttsToastTimeoutRef.current);
    ttsToastTimeoutRef.current = setTimeout(() => {
      setTtsToastNotice('');
      ttsToastTimeoutRef.current = null;
    }, 2600);
  }, []);

  const resolveVoiceLabel = useCallback(async (voiceId?: string | null) => {
    if (!voiceId) return t('chat.voice.default');
    if (voiceNameByIdRef.current[voiceId]) return voiceNameByIdRef.current[voiceId];
    try {
      const catalog = await getVoiceCatalog();
      voiceNameByIdRef.current = catalog.reduce<Record<string, string>>((acc, voice) => {
        acc[voice.id] = voice.name;
        return acc;
      }, {});
      return voiceNameByIdRef.current[voiceId] ?? voiceId;
    } catch {
      return voiceId;
    }
  }, [t]);

  const flushPendingAssistantDelta = () => {
    const assistantId = pendingAssistantIdRef.current;
    const pending = pendingDeltaRef.current;
    if (!assistantId || !pending) return;

    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].id === assistantId) {
        const next = [...prev];
        next[lastIndex] = { ...next[lastIndex], content: `${next[lastIndex].content}${pending}` };
        return next;
      }

      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i].id !== assistantId) continue;
        const next = [...prev];
        next[i] = { ...next[i], content: `${next[i].content}${pending}` };
        return next;
      }
      return prev;
    });
    pendingDeltaRef.current = '';
  };

  const queueAssistantDelta = (assistantId: string, delta: string) => {
    pendingAssistantIdRef.current = assistantId;
    pendingDeltaRef.current += delta;
    if (deltaFlushTimerRef.current) return;
    deltaFlushTimerRef.current = setTimeout(() => {
      const targetId = pendingAssistantIdRef.current;
      const pending = pendingDeltaRef.current;
      if (!targetId || !pending) {
        deltaFlushTimerRef.current = null;
        return;
      }

      const chunk = pending.slice(0, STREAM_FLUSH_CHARS);
      pendingDeltaRef.current = pending.slice(chunk.length);
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].id === targetId) {
          const next = [...prev];
          next[lastIndex] = { ...next[lastIndex], content: `${next[lastIndex].content}${chunk}` };
          return next;
        }

        for (let i = prev.length - 1; i >= 0; i -= 1) {
          if (prev[i].id !== targetId) continue;
          const next = [...prev];
          next[i] = { ...next[i], content: `${next[i].content}${chunk}` };
          return next;
        }
        return prev;
      });

      deltaFlushTimerRef.current = null;
      if (pendingDeltaRef.current) {
        queueAssistantDelta(targetId, '');
      }
    }, STREAM_FLUSH_INTERVAL_MS);
  };

  const getMessageItemType = useCallback((item: UiMessage) => {
    if (item.imageUrl || item.isImageGenerating) return 'image';
    if (item.videoUrl || item.isVideoGenerating) return 'video';
    if (item.isArtifactGenerating) return 'artifact';
    return item.role;
  }, []);

  const isLikelyArtifactGenerationIntent = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    const asksForGeneration =
      /\b(generate|create|make|build|export|produce|draft|write|prepare|compose)\b/.test(normalized)
      || /\b(give me|provide|send me|share|return|output)\b/.test(normalized)
      || /\b(i need|i want|can i get|could you|please)\b/.test(normalized);
    const asksForFile =
      /\b(file|artifact|document|docx|pdf|csv|xlsx|sheet|markdown|md|txt|json)\b/.test(normalized);
    const asksForFormatStyle =
      /\b(in|as)\s+(a\s+)?(docx|pdf|csv|xlsx|markdown|md|txt|json)\b/.test(normalized)
      || /\.(docx|pdf|csv|xlsx|md|txt|json)\b/.test(normalized);
    const likelyRequestQuestion =
      /\?$/.test(normalized) && /\b(can|could|would|will)\b/.test(normalized);
    return (asksForGeneration && asksForFile) || (asksForFile && asksForFormatStyle) || (likelyRequestQuestion && asksForFile);
  }, []);

  const isChartGenerationRequest = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return /\b(?:bar|line|pie|area|scatter|bubble|column|donut|doughnut)\s+charts?\b/i.test(normalized)
      || /\b(?:charts?|graphs?|plots?|data visuali[sz]ation)\b/i.test(normalized);
  }, []);

  const handleSend = (options?: { skipDocumentFormWarning?: boolean }) => {
      const run = async () => {
        const trimmed = inputValueRef.current.trim();
        const attachmentsForSend = [...attachedAssets];
        clearPromptSuggestions();
        ++sendAttemptSeqRef.current;
        const now = Date.now();
        const sinceLastAttemptMs = now - lastSendAttemptAtRef.current;
        const SEND_DEBOUNCE_MS = 450;
        let lastEndpoint = `${API_BASE_URL}/chat`;
        let lastIdempotencyKey = '';
        let activeAuthConversationId: string | null = authConversationId ?? null;

        if (!trimmed && attachmentsForSend.length === 0) {
          return;
        }

        if (
          !options?.skipDocumentFormWarning
          && screenMode === 'chat'
          && trimmed
          && hasExpandedDocumentWizard()
        ) {
          setDocumentFormWarningVisible(true);
          return;
        }

        if (screenMode === 'chat' && options?.skipDocumentFormWarning && hasExpandedDocumentWizard()) {
          collapseAllDocumentWizards();
        }

        if (
          isDedicatedMediaScreen
          && !trimmed
          && attachmentsForSend.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'))
        ) {
          setMessages((prev) => {
            const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
            return [
              ...withoutSyntheticWelcome,
              {
                id: `assistant-prompt-required-${Date.now()}`,
                role: 'assistant',
                content:
                  screenMode === 'image-to-video'
                    ? 'Add a prompt describing the motion, camera movement, or scene you want before sending this image.'
                    : 'Add a prompt describing the changes you want before sending this image.',
                createdAt: Date.now(),
              },
            ];
          });
          autoScrollEnabledRef.current = true;
          setShowScrollToBottom(false);
          scrollToBottom();
          return;
        }

        if (sinceLastAttemptMs < SEND_DEBOUNCE_MS) {
          return;
        }

        if (isSendRunInFlightRef.current || isSending || isUnderstandingPrompt) {
          return;
        }
        lastSendAttemptAtRef.current = now;
        isSendRunInFlightRef.current = true;
        setIsSending(true);
        setStatusNotice('');

        const shouldShowPromptUnderstanding =
          (screenMode === 'image-to-video' || screenMode === 'edit-image') && trimmed.length > 0;
        if (shouldShowPromptUnderstanding) {
          setIsUnderstandingPrompt(true);
        }

        let requestKind: 'chat' | 'image' | 'video' = 'chat';
        let usedVideoReferenceFollowUp = false;
        let requestedVideoPrompt = '';
        let requestedVideoConversationId = '';
        let requestedVideoStartedAt = 0;
        let didMutateChats = false;
        let responseLogEmitted = false;
        let assistantResponseBuffer = '';
        let responseRecoveryStartAt = 0;
        let assistantId = '';
        let activeAssistantId = '';

        const logResponsePayloadForAttempt = (responsePayload: Record<string, unknown>) => {
          if (!__DEV__ || responseLogEmitted) return;
          responseLogEmitted = true;
          const payload = {
            endpoint: lastEndpoint,
            requestKind,
            isAuthenticated,
            conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
            idempotencyKey: lastIdempotencyKey || null,
            ...responsePayload,
          };
          try {
            console.log('[chat-send:response]', JSON.stringify(payload));
          } catch {
            console.log('[chat-send:response]', payload);
          }
        };
        const logParsedResponseForAttempt = (raw: string) => {
          const parsedText = raw.trim();
          if (!parsedText) return;
          logResponsePayloadForAttempt({ responseText: parsedText });
        };

        try {
          let effectivePrompt = trimmed;
          let mediaPromptRewriteResult: MediaPromptRewriteResult | null = null;

          if (screenMode === 'image-to-video' || screenMode === 'edit-image') {
            mediaPromptRewriteResult = await resolveMediaPromptRewrite(screenMode, trimmed);
            const rewrittenPrompt = mediaPromptRewriteResult?.rewrittenPrompt?.trim();
            if (rewrittenPrompt) {
              effectivePrompt = rewrittenPrompt;
            }
          }

          const backendIntentHandoff = mediaPromptRewriteResult && !mediaPromptRewriteResult.belongsToCurrentScreen
            ? getScreenHandoffConfigFromIntent(mediaPromptRewriteResult.intent)
            : null;

          if (backendIntentHandoff) {
            lastEndpoint = `${API_BASE_URL}/media/prompts/rewrite`;
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'frontend-intent-handoff-blocked',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              screenMode,
              message: trimmed,
              language,
              model: activeModel,
              reference: composerMediaReference ?? null,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                label: asset.label,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                uri: asset.uri,
              })),
              handoffTarget: backendIntentHandoff.target,
              rewrittenPrompt: effectivePrompt,
              interpretedIntent: mediaPromptRewriteResult?.intent ?? null,
            });
            const userMessage: UiMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: trimmed,
              createdAt: Date.now(),
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                originalName: asset.fileName ?? asset.label,
                mimeType: asset.mimeType,
                fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
                url: asset.uri,
                thumbnailUrl: asset.uri,
              })),
            };
            const assistantMessage: UiMessage = {
              id: `assistant-handoff-${Date.now()}`,
              role: 'assistant',
              content: '',
              createdAt: Date.now() + 1,
              screenHandoff: backendIntentHandoff,
            };
            setAttachmentMenuOpen(false);
            setModelMenuOpen(false);
            if (attachmentsForSend.length) {
              setAttachedAssets([]);
            }
            inputValueRef.current = '';
            setInput('');
            setMessages((prev) => {
              const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
              return [...withoutSyntheticWelcome, userMessage, assistantMessage];
            });
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
            return;
          }

          const imageRequirement = getImageRequirementConfig(effectivePrompt, attachmentsForSend);
          if (imageRequirement) {
            lastEndpoint = mediaPromptRewriteResult ? `${API_BASE_URL}/media/prompts/rewrite` : `${API_BASE_URL}/chat/image-required`;
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'frontend-image-required-blocked',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              screenMode,
              message: trimmed,
              language,
              model: activeModel,
              rewrittenPrompt: effectivePrompt !== trimmed ? effectivePrompt : undefined,
              interpretedIntent: mediaPromptRewriteResult?.intent ?? null,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                label: asset.label,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                uri: asset.uri,
              })),
            });
            setMessages((prev) => {
              const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
              return [
                ...withoutSyntheticWelcome,
                {
                  id: `assistant-image-required-${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  createdAt: Date.now(),
                  imageRequirement,
                },
              ];
            });
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
            return;
          }

          const screenHandoff = screenMode === 'chat'
            ? null
            : getScreenHandoffConfig(effectivePrompt, attachmentsForSend);
          if (screenHandoff) {
            lastEndpoint = `${API_BASE_URL}/chat/intent-handoff`;
            const hasImageAttachment = attachmentsForSend.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));
            const isVideoIntent = Boolean(extractVideoPrompt(effectivePrompt)) || isLikelyVideoGenerationIntent(effectivePrompt);
            const isEditIntent = isLikelyImageEditIntent(effectivePrompt);
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'frontend-intent-handoff-blocked',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              screenMode,
              message: trimmed,
              language,
              model: activeModel,
              reference: composerMediaReference ?? null,
              rewrittenPrompt: effectivePrompt !== trimmed ? effectivePrompt : undefined,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                label: asset.label,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                uri: asset.uri,
              })),
              handoffTarget: screenHandoff.target,
              frontendAnalysis: {
                source: 'frontend-fallback',
                hasImageAttachment,
                isVideoIntent,
                isEditIntent,
                analyzedPrompt: effectivePrompt,
              },
            });
            const userMessage: UiMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: trimmed,
              createdAt: Date.now(),
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                originalName: asset.fileName ?? asset.label,
                mimeType: asset.mimeType,
                fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
                url: asset.uri,
                thumbnailUrl: asset.uri,
              })),
            };
            const assistantMessage: UiMessage = {
              id: `assistant-handoff-${Date.now()}`,
              role: 'assistant',
              content: '',
              createdAt: Date.now() + 1,
              screenHandoff,
            };
            setAttachmentMenuOpen(false);
            setModelMenuOpen(false);
            if (attachmentsForSend.length) {
              setAttachedAssets([]);
            }
            inputValueRef.current = '';
            setInput('');
            setMessages((prev) => {
              const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
              return [...withoutSyntheticWelcome, userMessage, assistantMessage];
            });
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
            return;
          }

          setIsUnderstandingPrompt(false);

          let detectedExpectedResponseType: import('@/types').ExpectedResponseType = 'text';
          let shouldRouteChartThroughChat = isChartGenerationRequest(trimmed);
          let analyzedUserMessage: UiMessage | null = null;
          let analyzedAssistantId = '';
          if (screenMode === 'chat' && isAuthenticated) {
            analyzedUserMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: trimmed,
              createdAt: Date.now(),
              referencedMedia: composerMediaReference ? { ...composerMediaReference } : undefined,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                originalName: asset.fileName ?? asset.label,
                mimeType: asset.mimeType,
                fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
                url: asset.uri,
                thumbnailUrl: asset.uri,
              })),
            };
            analyzedAssistantId = `assistant-${Date.now()}`;
            setAttachmentMenuOpen(false);
            setModelMenuOpen(false);
            if (attachmentsForSend.length) setAttachedAssets([]);
            Keyboard.dismiss();
            inputValueRef.current = '';
            setInput('');
            setMessages((prev) => [
              ...prev.filter((message) => !isWelcomeMessage(message)),
              analyzedUserMessage!,
              { id: analyzedAssistantId, role: 'assistant', content: '', createdAt: Date.now() + 1, isAnalyzing: true },
            ]);
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();

            lastEndpoint = `${API_BASE_URL}/documents/wizard/detect`;
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'auth-document-detect',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              message: trimmed,
              language,
              model: activeModel,
              reference: composerMediaReference ?? null,
              attachments: [],
            });
            const [classification, detection] = await Promise.all([
              classifyChatResponse(trimmed, attachmentsForSend.map(({ fileName, mimeType }) => ({ fileName, mimeType }))),
              detectDocumentRequest(trimmed),
            ]);
            shouldRouteChartThroughChat = shouldRouteChartThroughChat
              || classification.subIntent?.trim().toLowerCase() === 'chart_generate';
            detectedExpectedResponseType = detection.expectedResponseType === 'artifact'
              ? 'artifact'
              : classification.responseType;
            if (shouldRouteChartThroughChat) {
              detectedExpectedResponseType = 'artifact';
            }
            if (__DEV__) {
              try {
                console.log('[document-detect:result]', JSON.stringify({
                  endpoint: lastEndpoint,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  isDocumentRequest: detection.isDocumentRequest,
                  documentType: detection.documentType,
                  format: detection.format,
                  confidence: detection.confidence,
                  expectedResponseType: detection.expectedResponseType,
                  classificationResponseType: classification.responseType,
                  classificationSubIntent: classification.subIntent,
                  routeThroughRegularChat: shouldRouteChartThroughChat,
                  needsForm: detection.needsForm,
                  formReason: detection.formReason,
                }));
              } catch {
                console.log('[document-detect:result]', {
                  endpoint: lastEndpoint,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  isDocumentRequest: detection.isDocumentRequest,
                  documentType: detection.documentType,
                  format: detection.format,
                  confidence: detection.confidence,
                  expectedResponseType: detection.expectedResponseType,
                  classificationResponseType: classification.responseType,
                  classificationSubIntent: classification.subIntent,
                  routeThroughRegularChat: shouldRouteChartThroughChat,
                  needsForm: detection.needsForm,
                  formReason: detection.formReason,
                });
              }
            }

            const shouldStartDocumentWizard = detection.needsForm && (
              detection.isDocumentRequest
              || detection.expectedResponseType === 'artifact'
              || classification.responseType === 'artifact'
            );
            if (shouldStartDocumentWizard) {
              try {
                let wizardConversationId = activeAuthConversationId ?? authConversationId;
                if (!wizardConversationId) {
                  lastEndpoint = `${API_BASE_URL}/chat`;
                  const created = await createAuthenticatedConversation(getPromptTitle(trimmed, t('drawer.newChat')));
                  wizardConversationId = created.conversationId;
                  activeAuthConversationId = wizardConversationId;
                  setAuthConversationId(wizardConversationId);
                  didMutateChats = true;
                }
                const userMessageId = analyzedUserMessage.id;
                const assistantMessageId = analyzedAssistantId;
                lastEndpoint = `${API_BASE_URL}/documents/wizard/start`;
                logSendPayload({
                  endpoint: lastEndpoint,
                  mode: 'auth-document-start',
                  conversationId: wizardConversationId ?? activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  message: trimmed,
                  language,
                  model: activeModel,
                  reference: composerMediaReference ?? null,
                  attachments: [],
                  documentType: detection.documentType ?? null,
                  format: detection.format ?? null,
                  confidence: detection.confidence,
                  userRequest: trimmed,
                  userMessageId,
                  assistantMessageId,
                });
                setStatusNotice('Preparing your form...');
                const detectedDocumentType = detection.documentType?.trim() || 'document';
                const html = await startDocumentWizard(trimmed, {
                  conversationId: wizardConversationId ?? undefined,
                  userMessageId,
                  assistantMessageId,
                });
                logResponsePayloadForAttempt({
                  responseType: 'document-wizard-start',
                  html,
                  htmlLength: html.length,
                });
                const assistantMessage: UiMessage = {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: `Fill in the form below and submit it here in chat. I’ll use it to create a stronger ${detectedDocumentType} for you.`,
                  createdAt: Date.now() + 1,
                  documentWizard: {
                    html,
                    documentType: detectedDocumentType,
                    format: detection.format ?? 'pdf',
                    collapsed: false,
                    userMessageId,
                    assistantMessageId,
                  },
                };

                Keyboard.dismiss();
                inputValueRef.current = '';
                setInput('');
                setComposerMediaReference(null);
                setAttachmentMenuOpen(false);
                setModelMenuOpen(false);
                const nextMessages = messages
                  .filter((message) => !isWelcomeMessage(message))
                  .map((message) => (
                    message.documentWizard
                      ? {
                          ...message,
                          documentWizard: {
                            ...message.documentWizard,
                            collapsed: true,
                          },
                        }
                      : message
                  ));
                nextMessages.push(analyzedUserMessage, assistantMessage);
                setMessages((prev) => {
                  const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
                  return withoutSyntheticWelcome.map((message) => {
                    if (message.id === assistantMessageId) return assistantMessage;
                    return message.documentWizard
                      ? {
                          ...message,
                          documentWizard: { ...message.documentWizard, collapsed: true },
                        }
                      : message;
                  });
                });
                await setDocumentWizardDraftMessages(
                  getDocumentWizardDraftKey(wizardConversationId ?? null),
                  collectDocumentWizardDraftMessages(nextMessages),
                );
                if (wizardConversationId && wizardConversationId !== params.conversationId) {
                  router.setParams({ conversationId: wizardConversationId, newChat: undefined });
                }
                autoScrollEnabledRef.current = true;
                setShowScrollToBottom(false);
                scrollToBottom();
                return;
              } catch (wizardError) {
                // A form-required request must not fall through to normal chat: the
                // chat endpoint can only respond with instructions to fill a form.
                throw wizardError;
              } finally {
                setStatusNotice('');
              }
            } else {
              setStatusNotice('');
            }
          }

          const userMessage: UiMessage = analyzedUserMessage ?? {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            createdAt: Date.now(),
            referencedMedia: composerMediaReference ? { ...composerMediaReference } : undefined,
            attachments: attachmentsForSend.map((asset) => ({
              id: asset.id,
              originalName: asset.fileName ?? asset.label,
              mimeType: asset.mimeType,
              fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
              url: asset.uri,
              thumbnailUrl: asset.uri,
            })),
          };
          responseRecoveryStartAt = userMessage.createdAt - 1000;
          if (composerMediaReference) {
            pendingReferencedUserMessagesRef.current.push({
              sentAt: userMessage.createdAt,
              content: trimmed,
              reference: { ...composerMediaReference },
            });
          }

          assistantId = analyzedAssistantId || `assistant-${Date.now()}`;
          activeAssistantId = assistantId;
          const shouldUseBackendResponseTypeForLoading = screenMode === 'chat'
            && isAuthenticated;
          const shouldShowBackendArtifactLoading = shouldUseBackendResponseTypeForLoading
            && detectedExpectedResponseType === 'artifact';
          const suppressStreamingTextForArtifact = shouldShowBackendArtifactLoading
            || (
              !shouldUseBackendResponseTypeForLoading
              && isAuthenticated
              && !attachmentsForSend.length
              && isLikelyArtifactGenerationIntent(trimmed)
            );
          const shouldShowBackendImageLoading = !suppressStreamingTextForArtifact
            && shouldUseBackendResponseTypeForLoading
            && detectedExpectedResponseType === 'image';
          const shouldShowBackendVideoLoading = !suppressStreamingTextForArtifact
            && shouldUseBackendResponseTypeForLoading
            && detectedExpectedResponseType === 'video';

          hapticImpact();
          assistantFirstDeltaRef.current = false;
          pendingAssistantIdRef.current = assistantId;
          pendingDeltaRef.current = '';
          if (deltaFlushTimerRef.current) {
            clearTimeout(deltaFlushTimerRef.current);
            deltaFlushTimerRef.current = null;
          }
          setAttachmentMenuOpen(false);
          setModelMenuOpen(false);
          if (attachmentsForSend.length) {
            setAttachedAssets([]);
          }
          Keyboard.dismiss();
          inputValueRef.current = '';
          setInput('');
          setComposerMediaReference(null);
          setStreamingModelLabel(t(`chat.model.label.${activeModel}`));
          setMessages((prev) => {
            const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
            const assistantMessage: UiMessage = {
              id: assistantId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              isAnalyzing: false,
              isArtifactGenerating: shouldShowBackendArtifactLoading || suppressStreamingTextForArtifact,
              isImageGenerating: shouldShowBackendImageLoading,
              isVideoGenerating: shouldShowBackendVideoLoading,
            };
            if (analyzedUserMessage) {
              return withoutSyntheticWelcome.map((message) => message.id === assistantId ? assistantMessage : message);
            }
            return [
              ...withoutSyntheticWelcome,
              userMessage,
              assistantMessage,
            ];
          });
          autoScrollEnabledRef.current = true;
          setShowScrollToBottom(false);
          scrollToBottom();

        if (!isAuthenticated) {
          if (screenMode !== 'chat' || isMediaGenerationPrompt(trimmed)) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: t('chat.mediaNeedsLogin'),
                    }
                  : message,
              ),
            );
            return;
          }

          let conversationId = guestConversationId;
          if (!conversationId) {
            lastEndpoint = `${API_BASE_URL}/guest/session`;
            await ensureGuestSession();
            lastEndpoint = `${API_BASE_URL}/guest/chat`;
            const created = await createGuestConversation(getPromptTitle(trimmed, t('drawer.newChat')));
            conversationId = created.conversationId;
            setGuestConversationId(conversationId);
            didMutateChats = true;
          }

          lastEndpoint = `${API_BASE_URL}/guest/chat/${conversationId}/messages`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'guest-stream-chat',
            conversationId,
            message: trimmed,
            language,
            model: activeModel,
            reference: composerMediaReference ?? null,
            attachments: attachmentsForSend.map((asset) => ({
              id: asset.id,
              label: asset.label,
              fileName: asset.fileName,
              mimeType: asset.mimeType,
              uri: asset.uri,
            })),
          });
          await sendGuestMessageStream(
            conversationId,
            trimmed,
            (event) => {
              if (event.type === 'meta') {
                setStreamingModelLabel(
                  resolveModelBadgeLabel(event.model, activeModel),
                );
              }
              if (event.type === 'delta') {
                if (!assistantFirstDeltaRef.current) {
                  assistantFirstDeltaRef.current = true;
                  hapticSelection();
                }
                assistantResponseBuffer += event.content;
                if (!suppressStreamingTextForArtifact) {
                  queueAssistantDelta(assistantId, event.content);
                }
              }
              if (event.type === 'done') {
                if (!suppressStreamingTextForArtifact) {
                  flushPendingAssistantDelta();
                }
                hapticSuccess();
                setStreamingModelLabel(null);
                logParsedResponseForAttempt(assistantResponseBuffer);
                const now = Date.now();
                const currentUpsellState = guestUpsellStateRef.current;
                const isExpired =
                  currentUpsellState.windowStartedAt <= 0
                  || now - currentUpsellState.windowStartedAt >= GUEST_UPSELL_WINDOW_MS;
                const baseState = isExpired
                  ? { windowStartedAt: now, responseCount: 0, shown: false }
                  : currentUpsellState;
                const nextUpsellState = {
                  ...baseState,
                  responseCount: baseState.responseCount + 1,
                };
                const shouldShowUpsellNow =
                  !nextUpsellState.shown && nextUpsellState.responseCount >= GUEST_UPSELL_AFTER_RESPONSES;
                if (shouldShowUpsellNow) {
                  nextUpsellState.shown = true;
                  setGuestUpsellVisible(true);
                }
                guestUpsellStateRef.current = nextUpsellState;
                void AsyncStorage.setItem(GUEST_UPSELL_STATE_KEY, JSON.stringify(nextUpsellState));
              }
              if (event.type === 'error') {
                throw new Error(event.message || 'Guest chat stream failed.');
              }
            },
            createIdempotencyKey(conversationId),
            language,
          );
          didMutateChats = true;
          return;
        }

        const extractedVideoPrompt = extractVideoPrompt(trimmed);
        const extractedImagePrompt = extractImagePrompt(trimmed);
        const hasAnyAttachment = attachmentsForSend.length > 0;
        const shouldUseBackendResponseTypeForMediaIntent = screenMode === 'chat'
          && isAuthenticated
          && !hasAnyAttachment
          && !composerMediaReference;
        const inferredImagePrompt = shouldUseBackendResponseTypeForMediaIntent
          ? (!shouldRouteChartThroughChat && detectedExpectedResponseType === 'image' ? trimmed : null)
          : (!extractedImagePrompt && isLikelyImageGenerationIntent(trimmed)
            ? trimmed
            : null);
        const effectiveImagePrompt = screenMode === 'chat' && hasAnyAttachment
          ? null
          : (
            shouldUseBackendResponseTypeForMediaIntent
              ? inferredImagePrompt
              : (extractedImagePrompt ?? inferredImagePrompt)
          );
        const imageAttachmentForVideoIntent = attachmentsForSend.find((asset) =>
          (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
        );
        const inferredVideoFromImagePrompt = shouldUseBackendResponseTypeForMediaIntent
          ? (detectedExpectedResponseType === 'video' ? trimmed : null)
          : (
            !extractedVideoPrompt && imageAttachmentForVideoIntent && isLikelyVideoGenerationIntent(trimmed)
              ? trimmed
              : null
          );
        const effectiveVideoPrompt = screenMode === 'chat' && hasAnyAttachment
          ? null
          : (
            shouldUseBackendResponseTypeForMediaIntent
              ? inferredVideoFromImagePrompt
              : (extractedVideoPrompt ?? inferredVideoFromImagePrompt)
          );
        const referencedKind = composerMediaReference?.kind;
        const isReferencedMediaQuestion = Boolean(composerMediaReference)
          && isLikelyReferencedMediaQuestionPrompt(trimmed);
        const shouldUseVideoFollowUp =
          referencedKind === 'video' && !isReferencedMediaQuestion && isLikelyVideoFollowUpPrompt(trimmed);
        const shouldUseImageFollowUp =
          referencedKind === 'image' && !isReferencedMediaQuestion && isLikelyImageFollowUpPrompt(trimmed);
        const shouldUseReferencedNonStreamChat =
          Boolean(composerMediaReference)
          && (
            isReferencedMediaQuestion
            || (
              !shouldUseVideoFollowUp
              && !shouldUseImageFollowUp
              && !effectiveVideoPrompt
              && !effectiveImagePrompt
            )
          );

        if (screenMode === 'image-to-video') {
          const imageAttachmentForVideo = imageAttachmentForVideoIntent;
          if (!imageAttachmentForVideo) {
            throw new Error('Please upload an image to continue.');
          }

          requestKind = 'video';
          if (videoGenerationInFlightRef.current || videoFromImageInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }

          const now = Date.now();
          const elapsedSinceLastStart = now - lastVideoGenerationStartAtRef.current;
          if (elapsedSinceLastStart < 8000) {
            const waitSeconds = Math.max(1, Math.ceil((8000 - elapsedSinceLastStart) / 1000));
            const cooldownMessage = t('chat.videoGenerationCooldown', { seconds: `${waitSeconds}` });
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: cooldownMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(cooldownMessage, 5000);
            return;
          }

          videoGenerationInFlightRef.current = true;
          videoFromImageInFlightRef.current = true;
          requestedVideoPrompt = trimmed;
          requestedVideoStartedAt = Date.now();
          lastVideoGenerationStartAtRef.current = now;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    videoPrompt: effectivePrompt,
                    isVideoGenerating: true,
                  }
                : item,
            ),
          );

          lastEndpoint = `${API_BASE_URL}/media/video/image-to-video`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-media-image-to-video',
            prompt: effectivePrompt,
            duration: 5,
            aspectRatio: '16:9',
            attachments: [
              {
                id: imageAttachmentForVideo.id,
                label: imageAttachmentForVideo.label,
                fileName: imageAttachmentForVideo.fileName,
                mimeType: imageAttachmentForVideo.mimeType,
                uri: imageAttachmentForVideo.uri,
              },
            ],
          });

          const generatedVideo = await generateVideoFromImageDirect({
            prompt: effectivePrompt,
            durationSeconds: 5,
            aspectRatio: '16:9',
            image: {
              uri: imageAttachmentForVideo.uri,
              fileName: imageAttachmentForVideo.fileName ?? imageAttachmentForVideo.label,
              mimeType: imageAttachmentForVideo.mimeType ?? 'image/jpeg',
            },
          });
          if (generatedVideo.conversationId) {
            setAuthConversationId(generatedVideo.conversationId);
          }

          let resolvedVideoUrl = resolveBackendAssetUrl(generatedVideo.videoUrl);
          let resolvedVideoPrompt = effectivePrompt;
          let resolvedVideoId: string | undefined;

          if (!resolvedVideoUrl && generatedVideo.jobId) {
            const resolvedVideo = await waitForVideoGeneration(generatedVideo.jobId);
            resolvedVideoUrl = resolvedVideo.videoUrl;
            resolvedVideoPrompt = resolvedVideo.videoPrompt || effectivePrompt;
            resolvedVideoId = resolvedVideo.videoId;
          }

          if (!resolvedVideoUrl) {
            throw new Error('Could not generate video right now.');
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: resolvedVideoPrompt,
                    videoId: resolvedVideoId,
                    videoPrompt: resolvedVideoPrompt,
                    videoUrl: resolvedVideoUrl,
                    isVideoGenerating: false,
                  }
                : item,
            ),
          );
          try {
            await hydrateDedicatedMediaConversation('image-to-video', {
              attempts: 8,
              delayMs: 900,
              preserveOnUnavailable: true,
            });
          } catch {
            // Keep the optimistic local media card if dedicated history is not yet reachable.
          }
          logResponsePayloadForAttempt({
            response: {
              videoUrl: generatedVideo.videoUrl ?? resolvedVideoUrl,
              jobId: generatedVideo.jobId ?? null,
              generationTime: generatedVideo.generationTime ?? null,
              duration: generatedVideo.duration ?? 5,
            },
          });
          hapticSuccess();
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
          didMutateChats = true;
          return;
        }

        if (screenMode === 'edit-image') {
          const imageAttachmentForEdit = attachmentsForSend.find((asset) =>
            (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
          );
          if (!imageAttachmentForEdit) {
            throw new Error('Please upload an image to continue.');
          }

          requestKind = 'image';
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    imagePrompt: effectivePrompt,
                    isImageGenerating: true,
                  }
                : item,
            ),
          );

          lastEndpoint = `${API_BASE_URL}/media/image/edit`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-media-image-edit',
            prompt: effectivePrompt,
            attachments: [
              {
                id: imageAttachmentForEdit.id,
                label: imageAttachmentForEdit.label,
                fileName: imageAttachmentForEdit.fileName,
                mimeType: imageAttachmentForEdit.mimeType,
                uri: imageAttachmentForEdit.uri,
              },
            ],
          });

          const editedImage = await editImage({
            prompt: effectivePrompt,
            image: {
              uri: imageAttachmentForEdit.uri,
              fileName: imageAttachmentForEdit.fileName ?? imageAttachmentForEdit.label,
              mimeType: imageAttachmentForEdit.mimeType ?? 'image/jpeg',
            },
          });
          if (editedImage.conversationId) {
            setAuthConversationId(editedImage.conversationId);
          }
          const resolvedImageUrl = resolveBackendAssetUrl(editedImage.imageUrl);
          if (!resolvedImageUrl) {
            throw new Error('Could not edit image right now.');
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    imagePrompt: effectivePrompt,
                    imageUrl: resolvedImageUrl,
                    isImageGenerating: false,
                  }
                : item,
            ),
          );
          try {
            await hydrateDedicatedMediaConversation('edit-image', {
              attempts: 5,
              delayMs: 450,
              preserveOnUnavailable: true,
            });
          } catch {
            // Keep the optimistic local media card if dedicated history is not yet reachable.
          }
          logResponsePayloadForAttempt({
            response: {
              imageUrl: editedImage.imageUrl,
              generationTime: editedImage.generationTime ?? null,
            },
          });
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        let conversationId = authConversationId;
        if (!conversationId) {
          lastEndpoint = `${API_BASE_URL}/chat`;
          const created = await createAuthenticatedConversation(getPromptTitle(trimmed, t('drawer.newChat')));
          conversationId = created.conversationId;
          setAuthConversationId(conversationId);
          router.setParams({ conversationId, newChat: undefined });
          didMutateChats = true;
        }
        if (conversationId !== params.conversationId) {
          router.setParams({ conversationId, newChat: undefined });
        }
        activeAuthConversationId = conversationId;

        if (shouldUseVideoFollowUp || shouldUseImageFollowUp || shouldUseReferencedNonStreamChat) {
          requestKind = shouldUseVideoFollowUp ? 'video' : shouldUseImageFollowUp ? 'image' : 'chat';
          usedVideoReferenceFollowUp = shouldUseVideoFollowUp;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: shouldUseReferencedNonStreamChat ? '' : trimmed,
                    videoPrompt: shouldUseVideoFollowUp ? trimmed : item.videoPrompt,
                    imagePrompt: shouldUseImageFollowUp ? trimmed : item.imagePrompt,
                    isVideoGenerating: shouldUseVideoFollowUp,
                    isImageGenerating: shouldUseImageFollowUp,
                  }
                : item,
            ),
          );
          lastEndpoint = `${API_BASE_URL}/chat/${conversationId}/messages`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: shouldUseVideoFollowUp
              ? 'auth-non-stream-followup-video'
              : shouldUseImageFollowUp
                ? 'auth-non-stream-followup-image'
                : 'auth-non-stream-referenced-chat',
            conversationId,
            message: trimmed,
            reference: composerMediaReference ?? null,
            model: activeModel,
          });
          const nonStreamResult = await sendAuthenticatedMessageNonStream(
            conversationId,
            trimmed,
            activeModel,
            composerMediaReference ?? undefined,
            attachmentsForSend,
          );
          const detail = await getAuthenticatedConversation(conversationId, { force: true });
          applyAuthConversationDetail(detail);
          const latestAssistant = [...detail.messages]
            .reverse()
            .find((item) => (
              item.role === 'assistant'
              && item.content.trim().length > 0
              && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
            ));
          if (latestAssistant?.content) {
            logParsedResponseForAttempt(latestAssistant.content);
          } else if (nonStreamResult.data?.recoveredText) {
            logParsedResponseForAttempt(nonStreamResult.data.recoveredText);
          }
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        if (effectiveVideoPrompt) {
          const fullVideoPrompt = trimmed;
          const imageAttachmentForVideo = imageAttachmentForVideoIntent;
          requestKind = 'video';
          if (videoGenerationInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }
          if (imageAttachmentForVideo && videoFromImageInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }
          const now = Date.now();
          const elapsedSinceLastStart = now - lastVideoGenerationStartAtRef.current;
          if (elapsedSinceLastStart < 8000) {
            const waitSeconds = Math.max(1, Math.ceil((8000 - elapsedSinceLastStart) / 1000));
            const cooldownMessage = t('chat.videoGenerationCooldown', { seconds: `${waitSeconds}` });
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: cooldownMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(cooldownMessage, 5000);
            return;
          }
          videoGenerationInFlightRef.current = true;
          if (imageAttachmentForVideo) {
            videoFromImageInFlightRef.current = true;
          }
          requestedVideoPrompt = fullVideoPrompt;
          requestedVideoConversationId = conversationId;
          requestedVideoStartedAt = Date.now();
          lastVideoGenerationStartAtRef.current = now;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: fullVideoPrompt,
                    videoPrompt: fullVideoPrompt,
                    isVideoGenerating: true,
                  }
                : item,
            ),
          );
          lastEndpoint = imageAttachmentForVideo
            ? `${API_BASE_URL}/videos/from-image`
            : `${API_BASE_URL}/videos/generate`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: imageAttachmentForVideo ? 'auth-direct-video-from-image' : 'auth-direct-video-generate',
            conversationId,
            prompt: fullVideoPrompt,
            aspectRatio: '16:9',
            model: activeModel,
            reference: composerMediaReference ?? null,
            attachments: imageAttachmentForVideo
              ? [
                  {
                    id: imageAttachmentForVideo.id,
                    label: imageAttachmentForVideo.label,
                    fileName: imageAttachmentForVideo.fileName,
                    mimeType: imageAttachmentForVideo.mimeType,
                    uri: imageAttachmentForVideo.uri,
                  },
                ]
              : [],
          });
          const job = imageAttachmentForVideo
            ? await startVideoGenerationFromImage({
                conversationId,
                prompt: fullVideoPrompt,
                aspectRatio: '16:9',
                image: {
                  uri: imageAttachmentForVideo.uri,
                  fileName: imageAttachmentForVideo.fileName ?? imageAttachmentForVideo.label,
                  mimeType: imageAttachmentForVideo.mimeType ?? 'image/jpeg',
                },
              })
            : await startVideoGeneration({
                conversationId,
                prompt: fullVideoPrompt,
                aspectRatio: '16:9',
              });

          const resolvedVideo = await waitForVideoGeneration(job.jobId);

          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
            applyAuthConversationDetail(detail);
          } catch {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: resolvedVideo.videoPrompt || fullVideoPrompt,
                      videoId: resolvedVideo.videoId,
                      videoPrompt: resolvedVideo.videoPrompt || fullVideoPrompt,
                      videoUrl: resolvedVideo.videoUrl ?? undefined,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
          }
          hapticSuccess();
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
          didMutateChats = true;
          return;
        }

        if (effectiveImagePrompt) {
          const fullImagePrompt = trimmed;
          requestKind = 'image';
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: fullImagePrompt,
                    imagePrompt: fullImagePrompt,
                    isImageGenerating: true,
                  }
                : item,
            ),
          );
          lastEndpoint = `${API_BASE_URL}/images/generate`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-image-generate',
            conversationId,
            prompt: fullImagePrompt,
            style: 'cinematic',
            model: activeModel,
            reference: composerMediaReference ?? null,
          });
          const generated = await generateImage({
            conversationId,
            prompt: fullImagePrompt,
            style: 'cinematic',
          });
          const resolvedImageUrl = resolveBackendAssetUrl(generated.imageUrl);
          if (!resolvedImageUrl) {
            throw new Error('Could not generate image right now.');
          }
          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
            applyAuthConversationDetail(detail);
          } catch {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: generated.prompt || fullImagePrompt,
                      imageId: generated.id,
                      imagePrompt: generated.prompt || fullImagePrompt,
                      imageUrl: resolvedImageUrl,
                      isImageGenerating: false,
                    }
                  : item,
              ),
            );
          }
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        lastEndpoint = `${API_BASE_URL}/chat/${conversationId}/messages`;
        const useMobileNonStreamWorkaround = false;
        const authSendMode =
          Platform.OS !== 'web'
            ? (useMobileNonStreamWorkaround ? 'auth-non-stream-chat-mobile' : 'auth-stream-chat-mobile')
            : 'auth-stream-chat';
        const mobileAuthModelForTextChat: 'ultra' | 'smart' | 'swift' = activeModel;
        logSendPayload({
          endpoint: lastEndpoint,
          mode: authSendMode,
          conversationId,
          message: trimmed,
          language,
          model: mobileAuthModelForTextChat,
          reference: composerMediaReference ?? null,
          attachments: attachmentsForSend.map((asset) => ({
            id: asset.id,
            label: asset.label,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            uri: asset.uri,
          })),
        });
        await sendAuthenticatedMessageStream(
          conversationId,
          trimmed,
          attachmentsForSend,
          (event) => {
              if (event.type === 'meta') {
                setStreamingModelLabel(
                  resolveModelBadgeLabel(event.model, activeModel),
                );
                if (event.messageId) {
                  const previousAssistantId = activeAssistantId;
                  activeAssistantId = event.messageId;
                  pendingAssistantIdRef.current = event.messageId;
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === previousAssistantId ? { ...message, id: event.messageId! } : message,
                    ),
                  );
                }
                return;
              }

              if (event.type === 'delta') {
                if (!assistantFirstDeltaRef.current) {
                  assistantFirstDeltaRef.current = true;
                  hapticSelection();
                }
                assistantResponseBuffer += event.content;
                if (!suppressStreamingTextForArtifact) {
                  queueAssistantDelta(activeAssistantId, event.content);
                }
                return;
              }

              if (event.type === 'done') {
                if (!suppressStreamingTextForArtifact) {
                  flushPendingAssistantDelta();
                }
                hapticSuccess();
                setStreamingModelLabel(null);
                logParsedResponseForAttempt(assistantResponseBuffer);
                const handoffFromAssistantText = getScreenHandoffConfigFromAssistantText(assistantResponseBuffer);
                const streamedAttachments = event.attachments ?? [];
                if (event.messageId) {
                  const previousAssistantId = activeAssistantId;
                  activeAssistantId = event.messageId;
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === previousAssistantId
                        ? {
                          ...message,
                          id: event.messageId!,
                          content: handoffFromAssistantText ? '' : message.content,
                          tokens: event.tokens,
                          attachments: streamedAttachments.length ? streamedAttachments : message.attachments,
                          screenHandoff: handoffFromAssistantText ?? message.screenHandoff,
                        }
                        : message,
                    ),
                  );
                  void syncAssistantMessageAfterStream(
                    conversationId,
                    event.messageId,
                    previousAssistantId,
                    streamedAttachments,
                  );
                  return;
                }
                if (streamedAttachments.length) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? {
                            ...message,
                            content: handoffFromAssistantText ? '' : message.content,
                            attachments: streamedAttachments,
                            screenHandoff: handoffFromAssistantText ?? message.screenHandoff,
                          }
                        : message,
                    ),
                  );
                } else if (handoffFromAssistantText) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? {
                            ...message,
                            content: '',
                            screenHandoff: handoffFromAssistantText,
                          }
                        : message,
                    ),
                  );
                }
                void syncAssistantMessageAfterStream(
                  conversationId,
                  activeAssistantId,
                  assistantId,
                  streamedAttachments,
                );
              }
            },
          language,
          activeModel,
          (debugEvent) => {
            lastIdempotencyKey = debugEvent.idempotencyKey;
          },
        );
        const streamedText = assistantResponseBuffer.trim();
        if (streamedText.length > 0) {
          // Do not let an eventually-consistent backend snapshot overwrite already rendered text.
          // Reconcile in the background only when server has a non-empty assistant response.
          void (async () => {
            for (let attempt = 1; attempt <= 8; attempt += 1) {
              try {
                const detail = await getAuthenticatedConversation(conversationId, { force: true });
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (recoveredAssistant) {
                  applyAuthConversationDetail(detail);
                  break;
                }
              } catch {
                // keep trying
              }
              await new Promise((resolve) => setTimeout(resolve, 220 * attempt));
            }
          })();
        } else {
          try {
            await reconcileAuthConversationAfterSend(conversationId);
          } catch {
            throw new Error('Could not sync conversation after response.');
          }
        }
        didMutateChats = true;
      } catch (error) {
        const assistantMessageIdForRecovery = activeAssistantId || assistantId;
        const message = error instanceof Error ? error.message : t('chat.sendFailed');
        const friendlyMessage = getFriendlyErrorMessage(error, requestKind);
        const code = ((error as { code?: string } | undefined)?.code ?? '').toUpperCase();
        const status = (error as { status?: number } | undefined)?.status;
        const rawErrorMessage = (error as { message?: string } | undefined)?.message ?? '';
        const normalizedErrorMessage = rawErrorMessage.toLowerCase();
        const isLimitError = isLimitOrUpgradeError(error);
        const isRateLimited = isRateLimitedError(error);
        const limitRequestKind = getLimitKind(error, requestKind);
        const limitResetHours = getLimitResetHours(error);
        const limitVisibleMessage = getLimitNoticeMessage(limitRequestKind)
          + (limitResetHours !== null ? ` Your allowance resets in ${formatLimitResetDuration(limitResetHours)}.` : '');
        const isAuthStreamTransportError = code.startsWith('AUTH_STREAM_');
        const isIdempotencyInProgress =
          code === 'IDEMPOTENCY_IN_PROGRESS'
          || normalizedErrorMessage.includes('idempotency key is already in use')
          || normalizedErrorMessage.includes('idempotency_in_progress');
        const isLikelyTimeoutOrDisconnect =
          normalizedErrorMessage.includes('timeout')
          || normalizedErrorMessage.includes('network request failed')
          || normalizedErrorMessage.includes('socket hang up')
          || normalizedErrorMessage.includes('aborted');
        const delayedVideoError =
          requestKind === 'video'
          && (
            code === 'VIDEO_GENERATION_PENDING'
            || code === 'VIDEO_GENERATION_TIMEOUT'
            || message.toLowerCase().includes('too many video generation requests')
            || message.toLowerCase().includes('too many requests')
          );
        const isAuthStreamActiveServerError =
          isAuthenticated
          && requestKind === 'chat'
          && code === 'AUTH_STREAM_ACTIVE_SERVER_ERROR';
        const idempotencyVisibleMessage = 'Your previous request is still processing. Please wait a moment and try again.';
        const fastFailVisibleMessage = isIdempotencyInProgress
          ? idempotencyVisibleMessage
          : friendlyMessage;
        const bufferedAssistantText = assistantResponseBuffer.trim();
        if (isAuthenticated && attachmentsForSend.length) {
          setAttachedAssets(attachmentsForSend);
        }
        if (requestKind === 'video') {
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
        }
        if (
          requestKind === 'chat'
          && bufferedAssistantText.length > 0
          && isAuthStreamActiveServerError
        ) {
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: bufferedAssistantText,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery,
                role: 'assistant',
                content: bufferedAssistantText,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          hapticSuccess();
          didMutateChats = true;
          return;
        }
        if (isAuthenticated && requestKind === 'chat' && !isLimitError && (isRateLimited || isIdempotencyInProgress)) {
          setStreamingModelLabel(null);
          hapticError();
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: fastFailVisibleMessage,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery || `assistant-error-${Date.now()}`,
                role: 'assistant',
                content: fastFailVisibleMessage,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          showTransientNotice(fastFailVisibleMessage, isIdempotencyInProgress ? 5000 : 4000);
          didMutateChats = true;
          return;
        }
        if (usedVideoReferenceFollowUp && isLikelyTimeoutOrDisconnect && activeAuthConversationId) {
          for (let recoveryAttempt = 1; recoveryAttempt <= 24; recoveryAttempt += 1) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              const detail = await getAuthenticatedConversation(activeAuthConversationId, { force: true });
              const hasRecoveredVideo = detail.messages
                .slice()
                .reverse()
                .some((item) => (
                  item.role === 'assistant'
                  && Boolean(item.videoUrl)
                  && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                ));
              if (!hasRecoveredVideo) continue;
              applyAuthConversationDetail(detail);
              hapticSuccess();
              didMutateChats = true;
              return;
            } catch {
              // Continue recovery polling.
            }
          }
        }
        if (isAuthStreamActiveServerError && !activeAuthConversationId && !authConversationId) {
          const buffered = assistantResponseBuffer.trim();
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantMessageIdForRecovery
                ? {
                    ...item,
                    isImageGenerating: false,
                    isVideoGenerating: false,
                    isArtifactGenerating: false,
                    content: buffered || 'Response was interrupted. Please tap send to retry.',
                  }
                : item,
            ),
          );
          if (!buffered) {
            showTransientNotice('Response was interrupted. Please retry.');
          } else {
            hapticSuccess();
          }
          didMutateChats = true;
          return;
        }
        const recoveryConversationId = activeAuthConversationId ?? authConversationId;
        if (
          isAuthStreamActiveServerError
          && recoveryConversationId
        ) {
          let fallbackResponseText = '';
          try {
            const fallbackResponse = await sendAuthenticatedMessageNonStream(
              recoveryConversationId,
              trimmed,
              activeModel,
              composerMediaReference ?? undefined,
              attachmentsForSend,
            );
            fallbackResponseText = fallbackResponse.data?.recoveredText?.trim() ?? '';
          } catch {
            // Continue with best-effort recovery paths below.
          }

          if (fallbackResponseText) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantMessageIdForRecovery
                  ? {
                      ...item,
                      isImageGenerating: false,
                      isVideoGenerating: false,
                      isArtifactGenerating: false,
                      content: fallbackResponseText,
                    }
                  : item,
              ),
            );
            hapticSuccess();
            didMutateChats = true;
            void getAuthenticatedConversation(recoveryConversationId, { force: true })
              .then((detail) => {
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (recoveredAssistant) {
                  applyAuthConversationDetail(detail);
                }
              })
              .catch(() => {
                // Best-effort sync only; keep recovered text in-place.
              });
            return;
          }

          for (let recoveryAttempt = 1; recoveryAttempt <= 5; recoveryAttempt += 1) {
            try {
              if (recoveryAttempt > 1) {
                await new Promise((resolve) => setTimeout(resolve, 240 * recoveryAttempt));
              }
              const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
              const recoveredAssistant = [...detail.messages]
                .reverse()
                .find((item) => (
                  item.role === 'assistant'
                  && item.content.trim().length > 0
                  && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                ));
              if (!recoveredAssistant) continue;
              applyAuthConversationDetail(detail);
              hapticSuccess();
              didMutateChats = true;
              return;
            } catch {
              // Keep trying.
            }
          }

          if (assistantResponseBuffer.trim()) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantMessageIdForRecovery
                  ? {
                      ...item,
                      isImageGenerating: false,
                      isVideoGenerating: false,
                      isArtifactGenerating: false,
                      content: assistantResponseBuffer.trim(),
                    }
                  : item,
              ),
            );
            hapticSuccess();
            didMutateChats = true;
            return;
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantMessageIdForRecovery
                ? {
                    ...item,
                    isImageGenerating: false,
                    isVideoGenerating: false,
                    isArtifactGenerating: false,
                    content: 'Response was interrupted. Please tap send to retry.',
                  }
                : item,
            ),
          );
          showTransientNotice('Response was interrupted. Please retry.');
          didMutateChats = true;
          return;
        }
        if (isAuthenticated && (isAuthStreamTransportError || isIdempotencyInProgress)) {
          if (recoveryConversationId) {
            for (let recoveryAttempt = 1; recoveryAttempt <= 8; recoveryAttempt += 1) {
              try {
                await new Promise((resolve) => setTimeout(resolve, 280 * recoveryAttempt));
                const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (!recoveredAssistant) continue;
                applyAuthConversationDetail(detail);
                logParsedResponseForAttempt(recoveredAssistant.content);
                didMutateChats = true;
                return;
              } catch {
                // continue recovery retries
              }
            }
          }
        }
        try {
          console.log(
            '[chat-send:error]',
            JSON.stringify({
              endpoint: lastEndpoint,
              requestKind,
              isAuthenticated,
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              idempotencyKey: lastIdempotencyKey || null,
              code: code || null,
              status: status ?? null,
              message,
              rawErrorMessage,
            }),
          );
        } catch {
          console.log('[chat-send:error]', {
            endpoint: lastEndpoint,
            requestKind,
            isAuthenticated,
            conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
            idempotencyKey: lastIdempotencyKey || null,
            code: code || null,
            status: status ?? null,
            message,
            rawErrorMessage,
          });
        }
        if (delayedVideoError) {
          const delayedMessage = t('chat.videoGenerationDelayed');
          if (requestedVideoConversationId) {
            scheduleVideoAutoSync(
              requestedVideoConversationId,
              requestedVideoPrompt || trimmed,
              requestedVideoStartedAt || Date.now(),
            );
          }
          setMessages((prev) =>
            {
              let matched = false;
              const next = prev.map((item) => {
                if (item.id !== assistantMessageIdForRecovery) return item;
                matched = true;
                return {
                  ...item,
                  content: delayedMessage,
                  videoPrompt: requestedVideoPrompt || item.videoPrompt,
                  isVideoGenerating: true,
                };
              });
              if (!matched) {
                next.push({
                  id: `video-delayed-${Date.now()}`,
                  role: 'assistant',
                  content: delayedMessage,
                  createdAt: Date.now(),
                  videoPrompt: requestedVideoPrompt || trimmed,
                  isVideoGenerating: true,
                });
              }
              return next;
            },
          );
          showTransientNotice(delayedMessage, 7000);
          didMutateChats = true;
          return;
        }
        if (isLimitError) {
          showLimitNotice(limitRequestKind, limitResetHours);
        }
        hapticError();
        setStreamingModelLabel(null);

        const visibleErrorMessage = isIdempotencyInProgress
          ? idempotencyVisibleMessage
          : friendlyMessage;

        if (requestKind === 'chat' && bufferedAssistantText.length > 0) {
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: bufferedAssistantText,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery,
                role: 'assistant',
                content: bufferedAssistantText,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          didMutateChats = true;
          hapticSuccess();
          return;
        }

        if (!isLimitError) {
          showTransientNotice(visibleErrorMessage, isRateLimited ? 5000 : 3200);
        }
        setMessages((prev) =>
          {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
                return {
                  ...item,
                  isImageGenerating: false,
                  isVideoGenerating: false,
                  isArtifactGenerating: false,
                  content: isLimitError ? limitVisibleMessage : visibleErrorMessage,
                };
            });
            if (!matched) {
              next.push({
                id: `send-error-${Date.now()}`,
                role: 'assistant',
                content: isLimitError ? limitVisibleMessage : visibleErrorMessage,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          },
        );
        didMutateChats = true;
        } finally {
          flushPendingAssistantDelta();
          if (deltaFlushTimerRef.current) {
            clearTimeout(deltaFlushTimerRef.current);
            deltaFlushTimerRef.current = null;
          }
          setIsUnderstandingPrompt(false);
          setStreamingModelLabel(null);
          setIsSending(false);
          isSendRunInFlightRef.current = false;
          if (didMutateChats) {
            emitChatMutated();
          }
        }
    };

    void run();
  };

  const insertStarterPrompt = (prompt: string) => {
    hapticSelection();
    const value = prompt.trim();
    inputValueRef.current = value;
    setInput(value);
    setAttachmentMenuOpen(false);
    setModelMenuOpen(false);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const openPromptSuggestions = useCallback(() => {
    if (!input.trim()) return;
    hapticSelection();
    setPromptSuggestionsVisible(true);
  }, [input]);

  const closePromptSuggestions = useCallback(() => {
    setPromptSuggestionsVisible(false);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const applyPromptSuggestion = useCallback((suggestion: string) => {
    const value = suggestion.trim();
    inputValueRef.current = value;
    setInput(value);
    setPromptSuggestionsVisible(false);
    announceForA11y(t('promptSuggestions.addedA11y'));
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [announceForA11y, t]);

  const focusComposerInputSoon = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        composerInputRef.current?.focus();
      }, 60);
    });
  }, []);

  const toggleRecording = async () => {
    if (isRecordingRef.current) {
      hapticSelection();
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      hapticError();
      showTransientNotice(t('chat.speechPermError'));
      return;
    }

    hapticImpact();
    speechDraftRef.current = '';
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  };

  const takePhotoAttachment = async () => {
    setAttachmentMenuOpen(false);
    let result: Awaited<ReturnType<ImagePickerModule['launchCameraAsync']>>;
    try {
      const ImagePicker = await getImagePickerModule();
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showTransientNotice('Camera permission is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        mediaTypes: ['images'],
      });
    } catch {
      showTransientNotice('Camera is unavailable in this build.');
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fallbackFileName = `image-${Date.now()}.jpg`;
    logUploadSelection({
      source: 'camera',
      screenMode,
      fileName: asset.fileName ?? fallbackFileName,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    });
    setAttachedAssets((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: asset.fileName ?? fallbackFileName,
        uri: asset.uri,
        fileName: asset.fileName ?? fallbackFileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
    ]);
    focusComposerInputSoon();
  };

  const handleUploadImagePress = () => {
    setUploadOptionModalVisible(true);
  };

  const closeAttachmentMenu = useCallback(() => {
    setAttachmentMenuOpen(false);
    setTimeout(() => focusAccessibilityNode(uploadTriggerButtonRef.current), 120);
  }, []);

  const closeUploadOptionModal = useCallback(() => {
    setUploadOptionModalVisible(false);
    setTimeout(() => focusAccessibilityNode(uploadTriggerButtonRef.current), 120);
  }, []);

  const pickAttachment = async () => {
    setAttachmentMenuOpen(false);
    let asset: { fileName?: string | null; uri: string; mimeType?: string | null } | null;
    try {
      const ImagePicker = await getImagePickerModule();
      asset = await pickSingleImageFromLibrary(ImagePicker, {
        allowsEditing: false,
        quality: 0.9,
      });
    } catch (error) {
      showTransientNotice(error instanceof Error ? error.message : 'Image picker is unavailable in this build.');
      return;
    }

    if (!asset) return;
    const fallbackFileName = `image-${Date.now()}.jpg`;
    logUploadSelection({
      source: 'gallery',
      screenMode,
      fileName: asset.fileName ?? fallbackFileName,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    });
    setAttachedAssets((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: asset.fileName ?? fallbackFileName,
        uri: asset.uri,
        fileName: asset.fileName ?? fallbackFileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
    ]);
    focusComposerInputSoon();
  };

  const pickDocumentAttachment = async () => {
    if (!canAttachDocuments) {
      showTransientNotice('Document upload is available on paid plans only.');
      return;
    }

    if (documentPickerInFlightRef.current) {
      showTransientNotice('Document picker is already opening.');
      return;
    }

    documentPickerInFlightRef.current = true;
    try {
      let DocumentPicker: DocumentPickerModule;
      try {
        DocumentPicker = await getDocumentPickerModule();
      } catch (error) {
        showTransientNotice(error instanceof Error ? error.message : 'Document picker is unavailable in this build.');
        return;
      }

      let result: Awaited<ReturnType<DocumentPickerModule['getDocumentAsync']>>;
      try {
        result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: Platform.OS === 'ios'
            ? '*/*'
            : [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
              ],
        });
      } catch (error) {
        if (__DEV__) {
          console.log('[document-picker:pick-failed]', error);
        }
        showTransientNotice('Unable to open the document picker right now. Please try again.');
        return;
      }

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const lowerName = (asset.name ?? '').toLowerCase();
      const mime = (asset.mimeType ?? '').toLowerCase();
      const isAllowedMime =
        mime === 'application/pdf' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'text/plain';
      const isAllowedExtension =
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.txt');

      if (!isAllowedMime && !isAllowedExtension) {
        showTransientNotice('Only document attachments are supported: PDF, DOCX, TXT.');
        return;
      }

      setAttachedAssets((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: asset.name ?? 'document-attachment',
          uri: asset.uri,
          fileName: asset.name ?? `document-${Date.now()}`,
          mimeType: lowerName.endsWith('.pdf') ? 'application/pdf' : (asset.mimeType ?? undefined),
        },
      ]);
    } finally {
      documentPickerInFlightRef.current = false;
    }
  };

  const handleDocumentUploadPress = () => {
    setAttachmentMenuOpen(false);
    const openPicker = () => {
      void pickDocumentAttachment();
    };
    if (Platform.OS === 'ios') {
      setTimeout(openPicker, MOTION.duration.normal);
      return;
    }
    openPicker();
  };

  const removeAttachment = (id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  };

  const showTransientNotice = (message: string, durationMs = 3200) => {
    setUpgradeNoticeKind(null);
    setUpgradeNoticeResetHours(null);
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  };

  const toggleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    const previous = messageReactions[messageId];
    const next = previous === reaction ? undefined : reaction;

    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: next,
    }));
    hapticSelection();

    if (!isAuthenticated || !authConversationId) return;

    try {
      const server = await toggleAuthenticatedMessageReaction(authConversationId, messageId, reaction);
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: server.liked ? 'like' : server.disliked ? 'dislike' : undefined,
      }));
    } catch {
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: previous,
      }));
      showTransientNotice(t('chat.reactionFailed'));
    }
  };

  const toggleLocalReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    const previous = messageReactions[messageId];
    const next = previous === reaction ? undefined : reaction;
    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: next,
    }));
    hapticSelection();
  };

  const downloadImageMessage = async (message: UiMessage) => {
    const resolvedUrl = resolveBackendAssetUrl(message.imageUrl);
    if (!resolvedUrl) {
      showTransientNotice(t('chat.imageDownloadFailed'));
      return;
    }

    hapticSelection();
    showDownloadToast(t('chat.imageDownloadStarting'), null);

    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || 'jpg';
      const fileName = `cafa-ai-image-${message.imageId ?? Date.now()}.${extension}`;
      const target = new File(Paths.cache, fileName);
      if (target.exists) {
        target.delete();
      }

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      await saveMediaToCafaAlbum(downloaded.uri);
      showDownloadToast(t('chat.imageDownloadSuccess'));
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown image download failure';
      console.log(
        `[chat-image-download:error] endpoint=${resolvedUrl} message="${messageText}"`,
      );
      if (
        Platform.OS === 'ios'
        && (error as { code?: string } | undefined)?.code === IOS_PHOTO_PERMISSION_DENIED_CODE
      ) {
        Alert.alert(
          'Photos Permission Needed',
          'Allow Photos access in Settings to save images and videos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
      showDownloadToast(t('chat.imageDownloadFailed'), 5000);
      hapticError();
    }
  };

  const downloadVideoMessage = async (message: UiMessage) => {
    const resolvedUrl = resolveBackendAssetUrl(message.videoUrl);
    if (!resolvedUrl) {
      showTransientNotice(t('chat.videoDownloadFailed'));
      return;
    }

    hapticSelection();
    showDownloadToast(t('chat.videoDownloadStarting'), null);

    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || 'mp4';
      const fileName = `cafa-ai-video-${message.videoId ?? Date.now()}.${extension}`;
      const target = new File(Paths.cache, fileName);
      if (target.exists) {
        target.delete();
      }

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      await saveMediaToCafaAlbum(downloaded.uri);
      showDownloadToast(t('chat.videoDownloadSuccess'));
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown video download failure';
      console.log(
        `[chat-video-download:error] endpoint=${resolvedUrl} message="${messageText}"`,
      );
      if (
        Platform.OS === 'ios'
        && (error as { code?: string } | undefined)?.code === IOS_PHOTO_PERMISSION_DENIED_CODE
      ) {
        Alert.alert(
          'Photos Permission Needed',
          'Allow Photos access in Settings to save images and videos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
      showDownloadToast(t('chat.videoDownloadFailed'), 5000);
      hapticError();
    }
  };

  const shareGeneratedMediaMessage = async (options: {
    messageId: string;
    remoteUrl?: string;
    mediaId?: string;
    defaultExtension: string;
    filePrefix: 'image' | 'video';
    mimeType: string;
    notAvailableNotice: string;
    failedNotice: string;
  }) => {
    if (mediaShareInFlightRef.current) {
      showTransientNotice(t('chat.shareInProgress'));
      return;
    }

    const resolvedUrl = resolveBackendAssetUrl(options.remoteUrl);
    if (!resolvedUrl) {
      showTransientNotice(options.notAvailableNotice);
      return;
    }

    hapticSelection();
    showTransientNotice(t('chat.mediaSharePreparing'));
    setSharingMediaMessageId(options.messageId);
    mediaShareInFlightRef.current = true;
    try {
      const cacheKey = `${options.filePrefix}:${options.mediaId ?? resolvedUrl}`;
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || options.defaultExtension;
      const fileName = `cafa-ai-${options.filePrefix}-${options.mediaId ?? Date.now()}.${extension}`;
      const shareLocalUri = async (uri: string) => {
        const Sharing = await getSharingModule();
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: options.mimeType,
            dialogTitle: 'Share media',
          });
          return;
        }
        await Share.share({ url: uri });
      };

      const cached = sharedMediaCacheRef.current[cacheKey];
      if (cached?.uri) {
        try {
          await shareLocalUri(cached.uri);
          hapticSuccess();
          return;
        } catch {
          delete sharedMediaCacheRef.current[cacheKey];
        }
      }

      const target = new File(Paths.cache, fileName);
      if (target.exists) target.delete();

      const accessToken = await getAccessToken();
      let downloaded: Awaited<ReturnType<typeof File.downloadFileAsync>> | null = null;
      let lastDownloadError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          downloaded = await File.downloadFileAsync(resolvedUrl, target, {
            idempotent: true,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          break;
        } catch (error) {
          lastDownloadError = error;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
          }
        }
      }
      if (!downloaded) throw lastDownloadError ?? new Error('Media download failed.');

      sharedMediaCacheRef.current[cacheKey] = { uri: downloaded.uri, mimeType: options.mimeType, fileName };
      await shareLocalUri(downloaded.uri);
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown media share failure';
      console.log(`[chat-media-share:error] endpoint=${resolvedUrl} message="${messageText}"`);
      showTransientNotice(options.failedNotice);
      hapticError();
    } finally {
      mediaShareInFlightRef.current = false;
      setSharingMediaMessageId((current) => (current === options.messageId ? null : current));
    }
  };

  const shareImageMessage = async (message: UiMessage) => {
    await shareGeneratedMediaMessage({
      messageId: message.id,
      remoteUrl: message.imageUrl,
      mediaId: message.imageId,
      defaultExtension: 'jpg',
      filePrefix: 'image',
      mimeType: 'image/jpeg',
      notAvailableNotice: t('chat.imageDownloadFailed'),
      failedNotice: t('chat.shareFailed'),
    });
  };

  const shareVideoMessage = async (message: UiMessage) => {
    await shareGeneratedMediaMessage({
      messageId: message.id,
      remoteUrl: message.videoUrl,
      mediaId: message.videoId,
      defaultExtension: 'mp4',
      filePrefix: 'video',
      mimeType: 'video/mp4',
      notAvailableNotice: t('chat.videoDownloadFailed'),
      failedNotice: t('chat.shareFailed'),
    });
  };

  const setComposerReferenceFromMessage = (message: UiMessage, kind: 'image' | 'video') => {
    const candidateUrl = kind === 'image' ? message.imageUrl : message.videoUrl;
    const resolvedUrl = resolveBackendAssetUrl(candidateUrl);
    if (!resolvedUrl) {
      showTransientNotice(kind === 'image' ? t('chat.reference.imageUnavailable') : t('chat.reference.videoUnavailable'));
      return;
    }
    setComposerMediaReference({
      kind,
      id: kind === 'image' ? message.imageId : message.videoId,
      url: resolvedUrl,
    });
    const addedMessage = kind === 'image' ? t('chat.reference.imageAdded') : t('chat.reference.videoAdded');
    showTransientNotice(addedMessage);
    announceForA11y(addedMessage);
    hapticSuccess();
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const downloadGeneratedFileAttachment = async (attachment: UiMessageAttachment, messageId: string) => {
    const rawUrl = attachment.url;
    const resolvedUrl = resolveBackendAssetUrl(rawUrl);
    if (!resolvedUrl) {
      showTransientNotice('Could not download this file right now.');
      return;
    }

    const attachmentId = attachment.id ?? `${messageId}-${attachment.originalName ?? 'file'}`;
    setDownloadingAttachmentId(attachmentId);
    hapticSelection();
    showTransientNotice('Downloading file...');

    try {
      const isMarkdown = isMarkdownAttachment(attachment);
      const inferredExtension = (() => {
        const lowerName = (attachment.originalName ?? '').toLowerCase();
        const nameMatch = lowerName.match(/\.([a-z0-9]+)$/i);
        if (nameMatch?.[1]) return nameMatch[1];
        const mime = (attachment.mimeType ?? '').toLowerCase();
        if (mime.includes('pdf')) return 'pdf';
        if (mime.includes('markdown')) return 'md';
        if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx';
        if (mime.includes('json')) return 'json';
        if (mime.includes('csv')) return 'csv';
        if (mime.includes('plain')) return 'txt';
        return 'bin';
      })();
      const suggestedName = (attachment.originalName?.trim() || `cafa-ai-file-${Date.now()}.${inferredExtension}`)
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
      const finalName = /\.[a-z0-9]+$/i.test(suggestedName)
        ? suggestedName
        : `${suggestedName}.${inferredExtension}`;
      const target = new File(Paths.cache, finalName);
      if (target.exists) {
        target.delete();
      }

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (Platform.OS === 'android') {
        const persisted = await saveFileToDownloadsCafaFolder({
          localFileUri: downloaded.uri,
          fileName: finalName,
          mimeType: attachment.mimeType || (isMarkdown ? 'text/markdown' : 'application/octet-stream'),
        });
        showDownloadToast(`Saved to ${persisted.readableFilePath}`);
      } else {
        const Sharing = await getSharingModule();
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: attachment.mimeType || (isMarkdown ? 'text/markdown' : 'application/octet-stream'),
            dialogTitle: 'Save or share file',
          });
          showDownloadToast('File ready to save or share.');
        } else {
          await Share.share({
            message: finalName,
            url: downloaded.uri,
          });
          showDownloadToast('File ready to share.');
        }
      }
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown file download failure';
      console.log(`[chat-file-download:error] endpoint=${resolvedUrl} message="${messageText}"`);
      showTransientNotice('Could not download this file right now.');
      hapticError();
    } finally {
      setDownloadingAttachmentId((current) => (current === attachmentId ? null : current));
    }
  };

  const copyMessage = async (content: string) => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(content);
    showTransientNotice(t('chat.copied'));
    hapticSuccess();
  };

  const editPrompt = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    inputValueRef.current = trimmed;
    setInput(trimmed);
    hapticSelection();
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const shareMessage = async (content: string) => {
    if (!content.trim()) return;
    hapticSelection();
    try {
      await Share.share({ message: content });
    } catch {
      showTransientNotice(t('chat.shareFailed'));
    }
  };

  const stopReadAloudPlayback = useCallback(() => {
    try {
      ttsPlayerSubRef.current?.remove();
    } catch {
      // no-op
    }
    ttsPlayerSubRef.current = null;

    try {
      ttsPlayerRef.current?.pause();
    } catch {
      // no-op
    }
    try {
      ttsPlayerRef.current?.remove();
    } catch {
      // no-op
    }
    ttsPlayerRef.current = null;

    ttsFilesRef.current.forEach((file) => {
      try {
        if (file?.exists) {
          file.delete();
        }
      } catch {
        // no-op
      }
    });
    ttsFilesRef.current = [];

    Speech.stop();
    setReadingMessageId(null);
    setReadAloudSpeaker(null);
    setIsReadAloudLoading(false);
  }, []);

  const splitTextForTts = (text: string, maxLen = 1900) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const parts: string[] = [];
    let remaining = normalized;

    while (remaining.length > maxLen) {
      let breakAt = Math.max(
        remaining.lastIndexOf('. ', maxLen),
        remaining.lastIndexOf('! ', maxLen),
        remaining.lastIndexOf('? ', maxLen),
      );
      if (breakAt < Math.floor(maxLen * 0.5)) {
        breakAt = remaining.lastIndexOf(' ', maxLen);
      }
      if (breakAt <= 0) {
        breakAt = maxLen;
      }
      const chunk = remaining.slice(0, breakAt).trim();
      if (chunk) parts.push(chunk);
      remaining = remaining.slice(breakAt).trim();
    }

    if (remaining) parts.push(remaining);
    return parts;
  };

  const toggleReadAloud = (messageId: string, content: string) => {
    if (!content.trim()) return;

    if (readingMessageId === messageId) {
      hapticSelection();
      activeReadAloudRequestRef.current += 1;
      stopReadAloudPlayback();
      return;
    }

    hapticSelection();
    activeReadAloudRequestRef.current += 1;
    const requestId = activeReadAloudRequestRef.current;
    stopReadAloudPlayback();
    setReadingMessageId(messageId);

    const speakWithNativeFallback = () => {
      Speech.speak(content, {
        rate: GUEST_TTS_RATE,
        pitch: 1,
        onDone: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
        },
        onStopped: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
        },
        onError: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
          showTransientNotice(t('chat.readAloudFailed'));
        },
      });
    };

    const run = async () => {
      if (!isAuthenticated) {
        speakWithNativeFallback();
        return;
      }

      const synthEndpoint = `${API_BASE_URL}/voice/synthesize`;
      let selectedVoice: string | null = null;
      try {
        selectedVoice = await getDefaultVoicePreference();
        const selectedVoiceLabel = await resolveVoiceLabel(selectedVoice);
        setReadAloudSpeaker(
          t('chat.speakingWith', { voice: selectedVoiceLabel }),
        );
        setIsReadAloudLoading(true);
        const chunks = splitTextForTts(content);
        if (!chunks.length) {
          throw new Error('No text available for read-aloud.');
        }

        if (activeReadAloudRequestRef.current !== requestId) {
          return;
        }
        const files: File[] = [];
        for (let i = 0; i < chunks.length; i += 1) {
          const bytes = await synthesizeVoice({ text: chunks[i], voice: selectedVoice ?? undefined, speed: 1 });
          if (!bytes?.length) {
            throw new Error(`Empty TTS payload for chunk ${i + 1}.`);
          }
          const file = new File(Paths.cache, `chat-read-aloud-${messageId}-${Date.now()}-${i}.wav`);
          file.create({ intermediates: true, overwrite: true });
          file.write(bytes);
          files.push(file);
        }
        ttsFilesRef.current = files;

        const playChunk = async (index: number) => {
          if (activeReadAloudRequestRef.current !== requestId) return;
          const target = ttsFilesRef.current[index];
          if (!target) {
            stopReadAloudPlayback();
            return;
          }
          if (index === 0) {
            setIsReadAloudLoading(false);
          }
          const { createAudioPlayer } = await getExpoAudioModule();
          const player = createAudioPlayer(target.uri, { keepAudioSessionActive: true });
          ttsPlayerRef.current = player;
          ttsPlayerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
            if (!status.didJustFinish) return;
            try {
              ttsPlayerSubRef.current?.remove();
            } catch {
              // no-op
            }
            ttsPlayerSubRef.current = null;
            try {
              player.remove();
            } catch {
              // no-op
            }
            ttsPlayerRef.current = null;
            void playChunk(index + 1);
          });
          player.play();
        };

        await playChunk(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown TTS failure';
        console.log(
          `[tts:error] endpoint=${synthEndpoint} voice=${selectedVoice ?? 'default'} message="${message}"`,
        );
        if (activeReadAloudRequestRef.current !== requestId) {
          return;
        }
        setReadAloudSpeaker(t('chat.speakingWith', { voice: t('chat.voice.device') }));
        setIsReadAloudLoading(false);
        showTtsToast(t('chat.readAloudFallbackNative'));
        speakWithNativeFallback();
      }
    };

    void run();
  };

  useSpeechRecognitionEvent('start', () => {
    isRecordingRef.current = true;
    setIsRecording(true);
    hapticSelection();
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    speechDraftRef.current = transcript;
  });

  useSpeechRecognitionEvent('end', () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    const transcript = speechDraftRef.current.trim();
    if (!transcript) {
      return;
    }
    const nextValue = `${inputValueRef.current}${inputValueRef.current ? '\n' : ''}${transcript}`;
    inputValueRef.current = nextValue;
    setInput(nextValue);
    hapticSuccess();
  });

  useSpeechRecognitionEvent('error', () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    hapticError();
    showTransientNotice(t('chat.speechError'));
  });

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (downloadToastTimeoutRef.current) clearTimeout(downloadToastTimeoutRef.current);
      if (ttsToastTimeoutRef.current) clearTimeout(ttsToastTimeoutRef.current);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (codeCopyTimeoutRef.current) clearTimeout(codeCopyTimeoutRef.current);
      if (deltaFlushTimerRef.current) clearTimeout(deltaFlushTimerRef.current);
      ExpoSpeechRecognitionModule.abort();
      activeReadAloudRequestRef.current += 1;
      stopReadAloudPlayback();
    };
  }, [stopReadAloudPlayback]);

  useEffect(() => {
    if (!isAuthenticated) return;

    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
    setComposerMediaReference(null);
    setGuestConversationId(null);

    setIsHydratingAuthChat(true);
    setAuthConversationId(null);
    setMessages([createWelcomeMessage()]);
    setMessageReactions({});
    rotateStarterPrompts();
    router.setParams({ conversationId: undefined, newChat: undefined });
    setIsHydratingAuthChat(false);
  }, [createWelcomeMessage, isAuthenticated, rotateStarterPrompts]);

  useEffect(() => {
    if (!isAuthenticated || !isDedicatedMediaScreen) return;

    let cancelled = false;
    const hydrate = async () => {
      setIsHydratingAuthChat(true);
      setAuthConversationId(null);
      try {
        const loaded = await hydrateDedicatedMediaConversation(screenMode, { attempts: 1 });
        if (!loaded && !cancelled) {
          rotateStarterPrompts();
        }
      } catch {
        if (!cancelled) {
          setMessages([createWelcomeMessage()]);
          setMessageReactions({});
          rotateStarterPrompts();
        }
      } finally {
        if (!cancelled) {
          setIsHydratingAuthChat(false);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    createWelcomeMessage,
    hydrateDedicatedMediaConversation,
    isAuthenticated,
    isDedicatedMediaScreen,
    rotateStarterPrompts,
    screenMode,
  ]);

  useEffect(() => {
    if (isDedicatedMediaScreen) return;
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    if (targetConversationId) return;

    let cancelled = false;
    const hydrateDrafts = async () => {
      const activeDraftKey = await getActiveDocumentWizardDraftKey();
      documentDraftHydratedRef.current = true;
      if (cancelled || !activeDraftKey) return;
      if (activeDraftKey.startsWith('conversation:')) {
        const conversationId = activeDraftKey.replace(/^conversation:/, '').trim();
        if (conversationId) {
          router.setParams({ conversationId, newChat: undefined });
          return;
        }
      }
      const drafts = await getDocumentWizardDraftMessages(activeDraftKey);
      if (cancelled || drafts.length === 0) return;
      setMessages((prev) => {
        const hasExistingDraft = prev.some((message) => message.documentWizard);
        if (hasExistingDraft) return prev;
        const base = prev.length === 1 && isWelcomeMessage(prev[0]) ? prev : [createWelcomeMessage()];
        return [...base, ...drafts];
      });
    };

    void hydrateDrafts();
    return () => {
      cancelled = true;
    };
  }, [createWelcomeMessage, isDedicatedMediaScreen, isWelcomeMessage, params.conversationId]);

  useEffect(() => {
    if (isDedicatedMediaScreen) return;
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    if (!documentDraftHydratedRef.current) return;
    const activeConversationId = isAuthenticated ? authConversationId : guestConversationId;
    if (targetConversationId !== (activeConversationId ?? '')) return;
    if (isHydratingAuthChat) return;

    const draftKey = getDocumentWizardDraftKey(targetConversationId);
    const drafts = collectDocumentWizardDraftMessages(messages);
    if (drafts.length === 0) {
      void clearDocumentWizardDraftMessages(draftKey);
      return;
    }
    void setDocumentWizardDraftMessages(draftKey, drafts);
  }, [
    collectDocumentWizardDraftMessages,
    getDocumentWizardDraftKey,
    authConversationId,
    guestConversationId,
    isAuthenticated,
    isHydratingAuthChat,
    isDedicatedMediaScreen,
    messages,
    params.conversationId,
  ]);

  useEffect(() => {
    if (isDedicatedMediaScreen) return;
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const newChatToken = typeof params.newChat === 'string' ? params.newChat.trim() : '';
    const isHydratingActiveConversationWhileSending = Boolean(
      isSending
      && targetConversationId
      && (
        (isAuthenticated && authConversationId === targetConversationId)
        || (!isAuthenticated && guestConversationId === targetConversationId)
      ),
    );

    if (isHydratingActiveConversationWhileSending) {
      return;
    }

    if (initialNewChatTokenRef.current === null) {
      initialNewChatTokenRef.current = newChatToken || '';
    }
    const shouldStartNewChat =
      newChatToken.length > 0
      && newChatToken !== initialNewChatTokenRef.current
      && newChatToken !== lastHandledNewChatTokenRef.current;
    if (shouldStartNewChat) {
      conversationHydrationRequestRef.current += 1;
      lastHandledNewChatTokenRef.current = newChatToken;
      setIsHydratingAuthChat(false);
      setAuthConversationId(null);
      setGuestConversationId(null);
      setInput('');
      inputValueRef.current = '';
      setAttachedAssets([]);
      setComposerMediaReference(null);
      setMessages([createWelcomeMessage()]);
      rotateStarterPrompts();
      router.setParams({ newChat: undefined, conversationId: undefined });
      return;
    }
    if (!targetConversationId) {
      conversationHydrationRequestRef.current += 1;
      setIsHydratingAuthChat(false);
      return;
    }

    const requestId = conversationHydrationRequestRef.current + 1;
    conversationHydrationRequestRef.current = requestId;
    let cancelled = false;
    setIsHydratingAuthChat(true);
    setMessages([]);
    setMessageReactions({});
    if (isAuthenticated) {
      setAuthConversationId(targetConversationId);
      setGuestConversationId(null);
    } else {
      setGuestConversationId(targetConversationId);
      setAuthConversationId(null);
    }

    const isCurrentRequest = () => (
      !cancelled && conversationHydrationRequestRef.current === requestId
    );

    const hydrateTarget = async () => {
      try {
        if (isAuthenticated) {
          const detail = await getAuthenticatedConversation(targetConversationId, { force: true });
          if (!isCurrentRequest()) return;
          const mappedMessages = applyDescriptiveAttachmentNames(detail.messages.map(mapAuthMessageToUiMessage));
          const localDrafts = await getDocumentWizardDraftMessages(getDocumentWizardDraftKey(targetConversationId));
          if (!isCurrentRequest()) return;
          const mergedMessages = mergeDocumentWizardDraftMessages(mappedMessages, localDrafts);
          if (!mergedMessages.length) {
            setMessages([createWelcomeMessage()]);
            rotateStarterPrompts();
            setMessageReactions({});
            return;
          }
          setMessages(mergedMessages);
          setMessageReactions(() =>
            detail.messages.reduce<Record<string, 'like' | 'dislike' | undefined>>((acc, message) => {
              if (message.role !== 'assistant') return acc;
              acc[message.id] = message.reactions?.liked
                ? 'like'
                : message.reactions?.disliked
                  ? 'dislike'
                  : undefined;
              return acc;
            }, {}),
          );
          return;
        }

        const detail = await getGuestConversation(targetConversationId, { force: true });
        if (!isCurrentRequest()) return;
        if (!detail.messages.length) {
          setMessages([createWelcomeMessage()]);
          rotateStarterPrompts();
          return;
        }
        setMessages(
          detail.messages.map((message) => ({
            id: message._id,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
            createdAt: new Date(message.createdAt).getTime(),
          })),
        );
      } catch {
        if (!isCurrentRequest()) return;
        setMessages([{
          id: `conversation-load-error-${targetConversationId}`,
          role: 'assistant',
          content: 'This conversation could not be loaded. Please select it again to retry.',
          createdAt: Date.now(),
        }]);
        setMessageReactions({});
      } finally {
        if (isCurrentRequest()) {
          setIsHydratingAuthChat(false);
        }
      }
    };

    void hydrateTarget();
    return () => {
      cancelled = true;
    };
  }, [
    applyDescriptiveAttachmentNames,
    createWelcomeMessage,
    getDocumentWizardDraftKey,
    isAuthenticated,
    isSending,
    mergeDocumentWizardDraftMessages,
    mapAuthMessageToUiMessage,
    params.conversationId,
    params.newChat,
    isDedicatedMediaScreen,
    rotateStarterPrompts,
  ]);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
    setComposerMediaReference(null);
    setAuthConversationId(null);
    setGuestConversationId(null);
    setMessages([createWelcomeMessage()]);
    rotateStarterPrompts();
  }, [createWelcomeMessage, isAuthenticated, rotateStarterPrompts]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const syncOffset = (screenY?: number, fallbackHeight?: number) => {
      const windowHeight = Dimensions.get('window').height;
      const keyboardHeight = Math.max(0, fallbackHeight ?? 0);
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, windowHeight - screenY);
        const resolvedOffset = Math.max(overlap, keyboardHeight);
        setAndroidComposerOffset(Math.max(0, resolvedOffset - ANDROID_KEYBOARD_CALIBRATION));
        return;
      }
      setAndroidComposerOffset(Math.max(0, keyboardHeight - ANDROID_KEYBOARD_CALIBRATION));
    };

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const changeSub = Keyboard.addListener('keyboardDidChangeFrame', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setAndroidComposerOffset(0));

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const EPSILON = 2;

    const syncOffset = (screenY?: number, fallbackHeight?: number) => {
      const windowHeight = Dimensions.get('window').height;
      const keyboardHeight = Math.max(0, fallbackHeight ?? 0);
      const updateOffset = (next: number) => {
        const rounded = Math.max(0, Math.round(next));
        setIosComposerOffset((prev) => (Math.abs(prev - rounded) <= EPSILON ? prev : rounded));
      };
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, windowHeight - screenY);
        const resolvedOffset = Math.max(overlap, keyboardHeight);
        updateOffset(resolvedOffset - safeBottomInset);
        return;
      }
      updateOffset(keyboardHeight - safeBottomInset);
    };

    const showSub = Keyboard.addListener('keyboardWillShow', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const changeSub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      const height = event.endCoordinates.height ?? 0;
      if (height <= safeBottomInset + EPSILON) {
        setIosComposerOffset(0);
        return;
      }
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setIosComposerOffset(0);
    });

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, [safeBottomInset]);

  useEffect(() => {
    if (!isSending) {
      setStreamingDots('.');
      return;
    }

    const timer = setInterval(() => {
      setStreamingDots((prev) => (prev.length >= 3 ? '.' : `${prev}.`));
    }, 350);

    return () => clearInterval(timer);
  }, [isSending]);

  useEffect(() => {
    if (!messages.length) return;
    if (!autoScrollEnabledRef.current) return;
    scrollToBottom(false);
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    announceForA11y(
      attachmentMenuOpen
        ? screenConfig.attachmentMenuAnnouncement
        : 'Upload menu closed.',
    );
  }, [announceForA11y, attachmentMenuOpen, isAuthenticated, screenConfig.attachmentMenuAnnouncement]);

  useEffect(() => {
    if (!attachmentMenuOpen || !isAuthenticated) return;
    const timer = setTimeout(() => {
      const focusTarget = uploadImageOptionRef.current ?? (allowDocumentAttachment ? uploadDocumentOptionRef.current : uploadCancelOptionRef.current);
      focusAccessibilityNode(focusTarget);
    }, 180);
    return () => clearTimeout(timer);
  }, [allowDocumentAttachment, attachmentMenuOpen, isAuthenticated]);

  useEffect(() => {
    if (!uploadOptionModalVisible) return;
    const timer = setTimeout(() => {
      focusAccessibilityNode(takePhotoOptionRef.current ?? chooseGalleryOptionRef.current ?? chooserCancelOptionRef.current);
    }, 180);
    return () => clearTimeout(timer);
  }, [uploadOptionModalVisible]);

  useEffect(() => {
    if (activeModel === 'ultra' && !canUseUltraModel) {
      setActiveModel('smart');
    }
  }, [activeModel, canUseUltraModel]);

  const topBarModelSwitcher = isAuthenticated ? (
    <View
      className="relative rounded-full border px-1.5 py-1"
      style={{
        borderColor: topPillBorder,
        backgroundColor: topPillBg,
        zIndex: modelMenuOpen ? 120 : 1,
        elevation: modelMenuOpen ? 30 : 0,
      }}
    >
      <Pressable
        onPress={() => {
          hapticSelection();
          setModelMenuOpen((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('chat.model.select')}
        className="h-8 flex-row items-center rounded-full border px-3"
        style={{ borderColor: colors.primary, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
          {t(`chat.model.label.${activeModel}`)}
        </Text>
        <Ionicons
          name={modelMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={14}
          color={colors.textSecondary}
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      {modelMenuOpen ? (
        <Animated.View
          entering={FadeInDown.duration(MOTION.duration.normal)}
          className="absolute right-0 top-9 z-40 min-w-[240px] rounded-xl border p-1"
          style={{
            zIndex: 80,
            elevation: 24,
            borderColor: topPillBorder,
            backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF',
          }}
          onTouchStart={() => {
            menuTouchRef.current = true;
          }}
        >
          {availableChatModelOptions.map((model) => {
            const active = activeModel === model.key;
            const modelDescription = t(`chat.model.desc.${model.key}`);
            return (
              <Pressable
                key={model.key}
                onPress={() => {
                  hapticSelection();
                  setActiveModel(model.key as 'ultra' | 'smart' | 'swift');
                  setModelMenuOpen(false);
                }}
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: active ? `${colors.primary}1A` : 'transparent' }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.model.accessibility', { model: t(`chat.model.label.${model.key}`) })}
                accessibilityHint={modelDescription}
              >
                <Text style={{ color: active ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                  {t(`chat.model.label.${model.key}`)}
                </Text>
                <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {modelDescription}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  ) : undefined;

  return (
    <AppScreen
      title={t('app.name')}
      showHeading={false}
      contentTopOffset={-12}
      topAuthRightContent={topBarModelSwitcher}
    >
      <Modal
        visible={uploadOptionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeUploadOptionModal}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.68)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={closeUploadOptionModal}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <Animated.View
            entering={FadeInDown.duration(MOTION.duration.normal)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="menu"
            accessibilityLabel="Image upload options"
            accessibilityHint="Choose whether to take a photo or pick an image from your gallery."
            onAccessibilityEscape={closeUploadOptionModal}
            style={{
              backgroundColor: isDark ? '#0C0C0E' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              borderTopWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -4 },
              elevation: 20,
            }}
          >
            {/* Drag Handle */}
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: 20,
                opacity: 0.6,
              }}
            />

            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 18,
                textAlign: 'center',
              }}
            >
              Upload Image
            </Text>

            <Pressable
              onPress={() => {
                setUploadOptionModalVisible(false);
                void takePhotoAttachment();
              }}
              ref={takePhotoOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
              accessibilityHint="Opens the camera so you can capture an image to upload."
              className="flex-row items-center py-3.5 px-4 rounded-xl mb-3 border"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginLeft: 12,
                }}
              >
                Take a Photo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setUploadOptionModalVisible(false);
                void pickAttachment();
              }}
              ref={chooseGalleryOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Choose an image from gallery"
              accessibilityHint="Opens your photo gallery so you can pick an image to upload."
              className="flex-row items-center py-3.5 px-4 rounded-xl mb-5 border"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginLeft: 12,
                }}
              >
                Choose from Gallery
              </Text>
            </Pressable>

            <Pressable
              onPress={closeUploadOptionModal}
              ref={chooserCancelOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Cancel upload"
              accessibilityHint="Closes image upload options and returns to the composer."
              className="items-center py-3.5 px-4 rounded-xl"
              style={{
                backgroundColor: isDark ? '#222227' : '#E5E7EB',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={attachmentMenuOpen && screenMode !== 'image-to-video' && screenMode !== 'edit-image'}
        transparent
        animationType="fade"
        onRequestClose={closeAttachmentMenu}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.36)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={closeAttachmentMenu}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <Animated.View
            entering={FadeInDown.duration(MOTION.duration.normal)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="menu"
            accessibilityLabel="Upload options"
            accessibilityHint="Choose image upload or document upload."
            onAccessibilityEscape={closeAttachmentMenu}
            style={{
              backgroundColor: isDark ? '#0C0C0E' : '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              borderTopWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -4 },
              elevation: 18,
            }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: 16,
                opacity: 0.6,
              }}
            />

            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              Upload
            </Text>

            <Pressable
              ref={uploadImageOptionRef}
              focusable
              onPress={() => {
                setAttachmentMenuOpen(false);
                setUploadOptionModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={screenConfig.attachImageLabel}
              accessibilityHint={screenConfig.attachImageHint}
              className="flex-row items-center rounded-xl border px-4 py-3.5 mb-3"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12 }}>
                {screenConfig.attachImageLabel}
              </Text>
            </Pressable>

            {allowDocumentAttachment ? (
              <Pressable
                ref={uploadDocumentOptionRef}
                focusable
                onPress={handleDocumentUploadPress}
                accessibilityRole="button"
                accessibilityLabel={screenConfig.attachDocumentLabel}
                accessibilityHint={screenConfig.attachDocumentHint}
                className="flex-row items-center rounded-xl border px-4 py-3.5 mb-5"
                style={{
                  backgroundColor: isDark ? '#141416' : '#F9FAFB',
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12 }}>
                  {screenConfig.attachDocumentLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              ref={uploadCancelOptionRef}
              focusable
              onPress={closeAttachmentMenu}
              accessibilityRole="button"
              accessibilityLabel="Cancel upload menu"
              accessibilityHint="Closes upload options and returns to the composer."
              className="items-center rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: isDark ? '#222227' : '#E5E7EB',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={!isAuthenticated && guestUpsellVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGuestUpsellVisible(false)}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(4, 6, 12, 0.58)',
            justifyContent: 'flex-end',
            paddingHorizontal: 0,
            paddingBottom: 0,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('modal.closeDialog')}
            onPress={() => setGuestUpsellVisible(false)}
            style={{ position: 'absolute', inset: 0 }}
          />

          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: isDark ? '#101015' : '#FFFFFF',
              padding: 18,
              paddingBottom: Math.max(insets.bottom + 10, 18),
              shadowColor: '#000000',
              shadowOpacity: isDark ? 0.5 : 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <View className="mb-3 flex-row items-center">
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colors.primary}24` }}
              >
                <AppLogo compact showWordmark={false} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 }}>
                {t('chat.guestUpsell.title')}
              </Text>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.limit.dismiss')}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: isDark ? '#0C0C0F' : '#F3F4F6' }}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
              {t('chat.guestUpsell.body')}
            </Text>

            <View className="mt-5 flex-row justify-end gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.limit.dismiss')}
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                }}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                  {t('chat.limit.dismiss')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.signup')}
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                  router.push('/(auth)/signup');
                }}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                  {t('auth.signup')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.login')}
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                  router.push('/(auth)/login');
                }}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                  {t('auth.login')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        enabled={false}
      >
          <View
            className="flex-1"
            onTouchEnd={() => {
              if (menuTouchRef.current) {
                menuTouchRef.current = false;
                return;
              }
              if (modelMenuOpen || attachmentMenuOpen) {
                setModelMenuOpen(false);
                setAttachmentMenuOpen(false);
              }
            }}
          >

            {!isAuthenticated ? (
              <Animated.View entering={FadeInDown.duration(MOTION.duration.normal)} className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {t('chat.guestNotice')}
                </Text>
              </Animated.View>
            ) : null}
            {isAuthenticated && !!readAloudSpeaker ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start rounded-full border px-3 py-1.5"
                style={{ borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}14` }}
              >
                <View className="flex-row items-center">
                  {isReadAloudLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="volume-high-outline" size={13} color={colors.primary} />
                  )}
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 6 }}>
                    {isReadAloudLoading ? t('chat.voicePreparing') : readAloudSpeaker}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
            {isAuthenticated && !!ttsToastNotice ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start rounded-xl border px-3 py-2"
                style={{ borderColor: '#F59E0B', backgroundColor: isDark ? 'rgba(120,53,15,0.28)' : 'rgba(255,237,213,0.95)' }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                    {ttsToastNotice}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
            {isUnderstandingPrompt ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                accessibilityRole="progressbar"
                accessibilityLabel="Understanding your prompt"
                accessibilityHint="Cafa AI is interpreting your request before sending it."
                accessibilityState={{ busy: true }}
                className="mb-2 self-start rounded-full border px-3 py-1.5"
                style={{ borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}14` }}
              >
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Ionicons name="search-outline" size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 6 }}
                  >
                    {`Understanding your prompt${streamingDots}`}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
            {!!streamingModelLabel ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start rounded-full border px-3 py-1.5"
                style={{ borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}14` }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                  {`${streamingModelLabel}: ${streamingDots}`}
                </Text>
              </Animated.View>
            ) : null}

            <View className="mb-2 items-center">
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: 88,
                  backgroundColor: dividerPill,
                }}
              />
            </View>

            {isFreshChatState ? (
              <View className="mb-2">
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6 }}>
                  {t('chat.starter.tap')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
                >
                  {starterPrompts.map((prompt) => {
                    return (
                      <Pressable
                        key={prompt}
                        onPress={() => insertStarterPrompt(prompt)}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.quickPrompt.insert', { prompt })}
                        accessibilityHint={t('chat.quickPrompt.hint')}
                        className="rounded-2xl border px-3 py-2"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#111111' : '#F5F5F5',
                          maxWidth: Math.max(220, Math.min(296, screenWidth - 80)),
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 12 }} numberOfLines={2}>
                          {prompt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <FlashList
              ref={messagesListRef}
              className="flex-1"
              getItemType={getMessageItemType}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={
                isAuthenticated && isHydratingAuthChat ? (
                  <View className="px-2 py-2">
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('drawer.loadingChats')}</Text>
                  </View>
                ) : null
              }
              data={visibleMessages}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 2,
                paddingVertical: 6,
                paddingBottom: 72 + (keyboardComposerOffset > 0 ? 0 : Math.min(safeBottomInset, 8)),
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (autoScrollEnabledRef.current) {
                  scrollToBottom(false);
                }
              }}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                const isNearBottom = distanceFromBottom < 48;
                autoScrollEnabledRef.current = isNearBottom;
                const nextShow = !isNearBottom;
                if (showScrollButtonRef.current !== nextShow) {
                  showScrollButtonRef.current = nextShow;
                  setShowScrollToBottom(nextShow);
                }
              }}
              onScrollBeginDrag={() => Keyboard.dismiss()}
              renderItem={({ item }) => {
                const isUser = item.role === 'user';
                const reaction = messageReactions[item.id];
                const isReading = readingMessageId === item.id;
                const messageAttachments = item.attachments ?? [];
                const imageAttachments = messageAttachments.filter((attachment) => isImageAttachment(attachment));
                const fileAttachments = messageAttachments.filter((attachment) => !isImageAttachment(attachment));
                const isImageGenerating = !isUser && item.isImageGenerating && !item.imageUrl;
                const isVideoGenerating = !isUser && item.isVideoGenerating && !item.videoUrl;
                const isArtifactGenerating = !isUser && item.isArtifactGenerating && !item.videoUrl && !item.imageUrl;
                const isAnalyzing = !isUser && item.isAnalyzing;
                const isImageMessage = !isUser && Boolean(item.imageUrl);
                const isVideoMessage = !isUser && Boolean(item.videoUrl);
                const isScreenHandoffMessage = !isUser && Boolean(item.screenHandoff);
                const isImageRequirementMessage = !isUser && Boolean(item.imageRequirement);
                const isDocumentWizardMessage = !isUser && Boolean(item.documentWizard);
                const isReferencedMediaHighlighted = highlightedReferencedMediaTarget?.messageId === item.id
                  && (
                    (highlightedReferencedMediaTarget.kind === 'image' && isImageMessage)
                    || (highlightedReferencedMediaTarget.kind === 'video' && isVideoMessage)
                  );
                const hasAttachmentPreviews = imageAttachments.length > 0 || fileAttachments.length > 0;
                const shouldRenderMixedAttachmentMessage =
                  !isUser
                  && hasAttachmentPreviews
                  && !isImageMessage
                  && !isVideoMessage;
                return (
                  <Animated.View entering={FadeInUp.duration(MOTION.duration.normal)} className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <View
                      className={`${isScreenHandoffMessage || isImageRequirementMessage || isDocumentWizardMessage ? 'w-[96%] max-w-[96%]' : 'max-w-[88%]'} rounded-2xl`}
                      style={highlightedMessageId === item.id
                        ? {
                            borderWidth: 1,
                            borderColor: `${colors.primary}88`,
                            backgroundColor: isDark ? 'rgba(95,127,184,0.14)' : 'rgba(32,64,121,0.08)',
                            padding: 4,
                          }
                        : undefined}
                    >
                      {isAnalyzing ? (
                        <View className="flex-row items-center rounded-2xl px-3 py-2" style={{ backgroundColor: isDark ? '#111111' : '#F5F5F5' }}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>{t('chat.status.analyzing')}</Text>
                        </View>
                      ) : null}
                      {isImageGenerating ? (
                        <ImageGenerationPlaceholder
                          width={236}
                          height={248}
                          isDark={isDark}
                          accentColor={colors.primary}
                        />
                      ) : null}

                      {isVideoGenerating ? (
                        <VideoGenerationPlaceholder
                          width={236}
                          height={133}
                          isDark={isDark}
                          accentColor={colors.primary}
                        />
                      ) : null}

                      {isArtifactGenerating ? (
                        <FileGenerationPlaceholder
                          width={236}
                          height={116}
                          isDark={isDark}
                          accentColor={colors.primary}
                        />
                      ) : null}

                      {isScreenHandoffMessage ? (
                        <ScreenHandoffCard
                          title={item.screenHandoff!.title}
                          description={item.screenHandoff!.description}
                          ctaLabel={item.screenHandoff!.ctaLabel}
                          iconName={item.screenHandoff!.iconName as keyof typeof Ionicons.glyphMap}
                          isDark={isDark}
                          colors={colors}
                          onPress={() => openHandoffTarget(item.screenHandoff!.target)}
                        />
                      ) : null}

                      {isImageRequirementMessage ? (
                        <ImageRequirementCard
                          title={item.imageRequirement!.title}
                          description={item.imageRequirement!.description}
                          ctaLabel={item.imageRequirement!.ctaLabel}
                          iconName={item.imageRequirement!.iconName as keyof typeof Ionicons.glyphMap}
                          isDark={isDark}
                          colors={colors}
                          onPress={handleUploadImagePress}
                        />
                      ) : null}

                      {isDocumentWizardMessage ? (
                        <DocumentWizardCard
                          html={item.documentWizard!.html}
                          documentType={item.documentWizard!.documentType}
                          format={item.documentWizard!.format}
                          conversationId={authConversationId ?? params.conversationId ?? null}
                          userMessageId={item.documentWizard!.userMessageId}
                          assistantMessageId={item.documentWizard!.assistantMessageId ?? item.id}
                          collapsed={item.documentWizard!.collapsed}
                          isDark={isDark}
                          colors={colors}
                          onExpand={() => {
                            expandDocumentWizard(item.id);
                          }}
                          onComplete={(artifacts) => {
                            handleDocumentWizardComplete(
                              item.id,
                              item.documentWizard!.documentType,
                              artifacts,
                            );
                          }}
                        />
                      ) : null}

                      {!isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && isImageMessage ? (
                        <View style={{ position: 'relative' }}>
                          <Pressable
                            onPress={() => {
                              if (item.imageUrl) setImageLightboxUri(item.imageUrl);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('chat.generatedImageAlt')}
                          >
                            <View
                              className="overflow-hidden rounded-2xl border"
                              style={{
                                width: 236,
                                height: 248,
                                borderColor: colors.border,
                                backgroundColor: isDark ? '#101010' : '#FFFFFF',
                              }}
                            >
                              {(() => {
                                const source = resolveImageSource(item.imageUrl);
                                if (!source) {
                                  return <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 112 }} />;
                                }
                                return (
                                  <ExpoImage
                                    source={source}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      transform: [{ scale: 1.06 }],
                                    }}
                                    contentFit="cover"
                                    contentPosition="center"
                                    transition={0}
                                    accessible
                                    accessibilityLabel={item.imagePrompt?.trim()
                                      ? `${t('chat.generatedImageAlt')}: ${item.imagePrompt.trim()}`
                                      : t('chat.generatedImageAlt')}
                                  />
                                );
                              })()}
                            </View>
                          </Pressable>
                          {isReferencedMediaHighlighted ? (
                            <Animated.View
                              entering={FadeInDown.duration(180)}
                              exiting={FadeOutDown.duration(220)}
                              pointerEvents="none"
                              style={{ position: 'absolute', top: 8, right: 8 }}
                            >
                              <View
                                className="flex-row items-center rounded-full px-2 py-1"
                                style={{ backgroundColor: isDark ? 'rgba(32,64,121,0.94)' : 'rgba(32,64,121,0.9)' }}
                              >
                                <Ionicons name="arrow-down-circle" size={13} color="#FFFFFF" />
                                <Text style={{ marginLeft: 5, color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                  Referenced
                                </Text>
                              </View>
                            </Animated.View>
                          ) : null}
                        </View>
                      ) : null}

                      {!isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && isVideoMessage ? (
                        <View style={{ position: 'relative' }}>
                          <ChatVideoCard
                            uri={item.videoUrl!}
                            width={236}
                            height={133}
                            borderColor={colors.border}
                            backgroundColor={isDark ? '#101010' : '#FFFFFF'}
                            accessibilityLabel={item.videoPrompt?.trim()
                              ? `${t('chat.generatedVideoAlt')}: ${item.videoPrompt.trim()}`
                              : t('chat.generatedVideoAlt')}
                          />
                          {isReferencedMediaHighlighted ? (
                            <Animated.View
                              entering={FadeInDown.duration(180)}
                              exiting={FadeOutDown.duration(220)}
                              pointerEvents="none"
                              style={{ position: 'absolute', top: 8, right: 8 }}
                            >
                              <View
                                className="flex-row items-center rounded-full px-2 py-1"
                                style={{ backgroundColor: isDark ? 'rgba(32,64,121,0.94)' : 'rgba(32,64,121,0.9)' }}
                              >
                                <Ionicons name="arrow-down-circle" size={13} color="#FFFFFF" />
                                <Text style={{ marginLeft: 5, color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                  Referenced
                                </Text>
                              </View>
                            </Animated.View>
                          ) : null}
                        </View>
                      ) : null}

                      {!isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && (shouldRenderMixedAttachmentMessage || (!isImageMessage && !isVideoMessage)) && hasAttachmentPreviews ? (
                        <View className="mb-2 gap-1.5">
                          {!isImageMessage && !isVideoMessage ? imageAttachments.map((attachment, index) => {
                            const imageUri = resolveAttachmentPreviewUri(attachment);
                            if (!imageUri) return null;
                            const previewSource = resolveImageSource(imageUri);
                            return (
                              <View
                                key={`${item.id}-img-${attachment.id ?? index}`}
                                className="overflow-hidden rounded-2xl border"
                                style={{
                                  width: 236,
                                  height: 188,
                                  borderColor: colors.border,
                                  backgroundColor: isDark ? '#101010' : '#FFFFFF',
                                }}
                              >
                                {previewSource ? (
                                  <ExpoImage
                                    source={previewSource}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                    }}
                                    contentFit="cover"
                                    contentPosition="center"
                                    transition={0}
                                    accessible
                                    accessibilityLabel={attachment.originalName ?? t('chat.attachImage')}
                                  />
                                ) : (
                                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 84 }} />
                                )}
                              </View>
                            );
                          }) : null}

                          {fileAttachments.map((attachment, index) => {
                            const fileName = attachment.originalName ?? 'Attachment';
                            const lowerName = fileName.toLowerCase();
                            const isPdf = lowerName.endsWith('.pdf') || (attachment.mimeType ?? '').includes('pdf');
                            const isMarkdown = lowerName.endsWith('.md') || (attachment.mimeType ?? '').includes('markdown');
                            const isDoc = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
                            const attachmentId = attachment.id ?? `${item.id}-${fileName}`;
                            const isDownloadingAttachment = downloadingAttachmentId === attachmentId;
                            const showDownloadAction = !isUser && isGeneratedDownloadableFileAttachment(attachment);
                            const iconName = isPdf
                              ? 'document-attach-outline'
                              : isMarkdown
                                ? 'document-outline'
                              : isDoc
                                ? 'document-text-outline'
                                : 'document-outline';
                            return (
                              <View
                                key={`${item.id}-file-${attachment.id ?? index}`}
                                className="flex-row items-center rounded-xl border px-3 py-2"
                                style={{
                                  borderColor: isUser ? `${colors.primary}99` : colors.border,
                                  backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                                }}
                              >
                                <Ionicons name={iconName} size={16} color={isUser ? '#FFFFFF' : colors.textSecondary} />
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    marginLeft: 8,
                                    flex: 1,
                                    color: isUser ? '#FFFFFF' : colors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: '600',
                                  }}
                                >
                                  {fileName}
                                </Text>
                                {showDownloadAction ? (
                                  <Pressable
                                    onPress={() => {
                                      void downloadGeneratedFileAttachment(attachment, item.id);
                                    }}
                                    disabled={isDownloadingAttachment}
                                    className="rounded-md px-2 py-1"
                                    style={{
                                      marginLeft: 8,
                                      backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : (isDark ? '#1A1A1A' : '#EAEAEA'),
                                      opacity: isDownloadingAttachment ? 0.65 : 1,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: isUser ? '#FFFFFF' : colors.textPrimary,
                                        fontSize: 11,
                                        fontWeight: '700',
                                      }}
                                    >
                                      {isDownloadingAttachment ? 'Downloading...' : 'Download'}
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {!isAnalyzing && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && (shouldRenderMixedAttachmentMessage || (!isImageMessage && !isVideoMessage)) && (item.content.trim() || !hasAttachmentPreviews) ? (
                        <View>
                          {isUser && item.referencedMedia ? (
                            <Pressable
                              onPress={() => jumpToReferencedMedia(item.referencedMedia!)}
                              accessibilityRole="button"
                              accessibilityLabel={t('chat.reference.jumpA11yLabel', { kind: item.referencedMedia.kind })}
                              accessibilityHint={t('chat.reference.jumpA11yHint')}
                              className="mb-1 self-end flex-row items-center rounded-full border px-2 py-1"
                              style={{ borderColor: colors.primary, backgroundColor: isDark ? '#112033' : '#EAF2FF' }}
                            >
                              <Ionicons
                                name={item.referencedMedia.kind === 'image' ? 'image-outline' : 'videocam-outline'}
                                size={12}
                                color={colors.primary}
                              />
                              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 6 }}>
                                {t('chat.reference.bubbleChip', { kind: item.referencedMedia.kind })}
                              </Text>
                            </Pressable>
                          ) : null}
                          <View
                            className="rounded-2xl px-3 py-2"
                            style={{
                              backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                            }}
                          >
                            {(() => {
                              const visibleContent = item.content || (isSending && !isUser ? streamingDots : '');
                              return renderMessageMarkdown(visibleContent, isUser);
                            })()}
                          </View>
                        </View>
                      ) : null}

                      {!isUser && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && isImageMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          showReference={screenMode === 'chat'}
                          onCopyPrompt={() => {
                            void copyMessage(item.imagePrompt || item.content);
                          }}
                          onLike={() => {
                            toggleLocalReaction(item.id, 'like');
                          }}
                          onUnlike={() => {
                            toggleLocalReaction(item.id, 'dislike');
                          }}
                          onDownload={() => {
                            void downloadImageMessage(item);
                          }}
                          onShare={() => {
                            void shareImageMessage(item);
                          }}
                          onReference={() => {
                            setComposerReferenceFromMessage(item, 'image');
                          }}
                          isShareBusy={sharingMediaMessageId === item.id}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyPrompt'),
                            copyHint: t('chat.tooltip.copyPrompt'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            unlike: t('chat.tooltip.unlike'),
                            unlikeHint: t('chat.tooltip.unlike'),
                            download: t('chat.tooltip.downloadImage'),
                            downloadHint: t('chat.tooltip.downloadImage'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            reference: t('chat.tooltip.referenceImage'),
                            referenceHint: t('chat.tooltip.referenceImageHint'),
                          }}
                        />
                      ) : null}

                      {!isUser && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isVideoGenerating && isVideoMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          showReference={screenMode === 'chat'}
                          onCopyPrompt={() => {
                            void copyMessage(item.videoPrompt || item.content);
                          }}
                          onLike={() => {
                            toggleLocalReaction(item.id, 'like');
                          }}
                          onUnlike={() => {
                            toggleLocalReaction(item.id, 'dislike');
                          }}
                          onDownload={() => {
                            void downloadVideoMessage(item);
                          }}
                          onShare={() => {
                            void shareVideoMessage(item);
                          }}
                          onReference={() => {
                            setComposerReferenceFromMessage(item, 'video');
                          }}
                          isShareBusy={sharingMediaMessageId === item.id}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyPrompt'),
                            copyHint: t('chat.tooltip.copyPrompt'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            unlike: t('chat.tooltip.unlike'),
                            unlikeHint: t('chat.tooltip.unlike'),
                            download: t('chat.tooltip.downloadVideo'),
                            downloadHint: t('chat.tooltip.downloadVideo'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            reference: t('chat.tooltip.referenceVideo'),
                            referenceHint: t('chat.tooltip.referenceVideoHint'),
                          }}
                        />
                      ) : null}

                      {!isUser && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageMessage && !isVideoMessage && item.content.trim() ? (
                        <MessageActionsRow
                          isReading={isReading}
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          onCopy={() => {
                            void copyMessage(item.content);
                          }}
                          onLike={() => {
                            void toggleReaction(item.id, 'like');
                          }}
                          onDislike={() => {
                            void toggleReaction(item.id, 'dislike');
                          }}
                          onShare={() => {
                            void shareMessage(item.content);
                          }}
                          onReadAloud={() => toggleReadAloud(item.id, item.content)}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyResponse'),
                            copyHint: t('chat.tooltip.copyResponse'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            dislike: t('chat.tooltip.dislike'),
                            dislikeHint: t('chat.tooltip.dislike'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            read: t('chat.tooltip.read'),
                            stopRead: t('chat.tooltip.stopRead'),
                            readHint: t('chat.tooltip.read'),
                          }}
                        />
                      ) : null}

                      {isUser && item.content.trim() ? (
                        <UserPromptActionsRow
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          onCopy={() => {
                            void copyMessage(item.content);
                          }}
                          onEdit={() => editPrompt(item.content)}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyPrompt'),
                            copyHint: t('chat.tooltip.copyPrompt'),
                            edit: t('chat.tooltip.editPrompt'),
                            editHint: t('chat.tooltip.editPrompt'),
                          }}
                        />
                      ) : null}
                    </View>
                  </Animated.View>
                );
              }}
            />
            <ImageLightbox
              visible={Boolean(imageLightboxUri)}
              uri={imageLightboxUri}
              onClose={() => setImageLightboxUri(null)}
              accessibilityLabel={t('chat.generatedImageAlt')}
            />

            {showScrollToBottom ? (
              <Animated.View entering={FadeInUp.duration(MOTION.duration.quick)} exiting={FadeOutDown.duration(MOTION.duration.quick)}>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  autoScrollEnabledRef.current = true;
                  setShowScrollToBottom(false);
                  scrollToBottom(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.scrollLatest')}
                accessibilityHint={t('chat.scrollLatestHint')}
                className="absolute right-3 h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  bottom: 96 + composerBottomInset,
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#151515' : '#FFFFFF',
                }}
              >
                <Ionicons name="arrow-down" size={18} color={colors.textPrimary} />
              </Pressable>
              </Animated.View>
            ) : null}

            <Animated.View
          layout={Platform.OS === 'ios' ? undefined : LinearTransition.springify().damping(24).stiffness(300).mass(0.72)}
          className="relative mt-2 rounded-[28px] border p-1.5"
          style={{
            borderColor: colors.primary,
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            marginBottom: composerBottomInset,
          }}
        >
          {hasPromptSuggestionTrigger ? (
            <Animated.View
              entering={FadeInUp.duration(MOTION.duration.quick)}
              exiting={FadeOutDown.duration(MOTION.duration.quick)}
              style={{
                position: 'absolute',
                top: -56,
                right: 10,
                zIndex: 30,
                elevation: 30,
              }}
            >
              <Pressable
                onPress={openPromptSuggestions}
                accessibilityRole="button"
                accessibilityLabel={t('chat.promptSuggestions.open')}
                accessibilityHint={t('chat.promptSuggestions.openHint')}
                accessibilityState={{ busy: isPromptSuggestionsLoading }}
                className="h-12 w-12 items-center justify-center rounded-full border"
                style={{
                  borderColor: colors.primary,
                  backgroundColor: isDark ? '#101826' : '#FFFFFF',
                  shadowColor: '#000000',
                  shadowOpacity: isDark ? 0.28 : 0.14,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 12,
                }}
              >
                <Ionicons
                  name={isPromptSuggestionsLoading ? 'sync-outline' : 'chatbubble-ellipses-outline'}
                  size={20}
                  color={colors.primary}
                />
              </Pressable>
            </Animated.View>
          ) : null}

          {useCompactComposerPlaceholder && !input.trim() ? (
            <Text
              pointerEvents="none"
              accessible={false}
              style={{
                position: 'absolute',
                top: COMPOSER_VERTICAL_PADDING + 6,
                left: 12,
                right: isAuthenticated ? 52 : 16,
                color: colors.textSecondary,
                fontSize: 12,
                lineHeight: 16,
                zIndex: 1,
              }}
            >
              {composerPlaceholder}
            </Text>
          ) : null}

          <TextInput
            ref={composerInputRef}
            value={input}
            onChangeText={(text) => {
              inputValueRef.current = text;
              setInput(text);
              if (!text) {
                clearPromptSuggestions();
                setComposerHeight(COMPOSER_MIN_HEIGHT);
                setComposerScrollable(false);
              }
            }}
            placeholder={useCompactComposerPlaceholder ? '' : composerPlaceholder}
            placeholderTextColor={colors.textSecondary}
            editable
            multiline
            maxLength={3000}
            onContentSizeChange={(event) => {
              if (!inputValueRef.current.trim()) {
                setComposerHeight((prev) => (prev === COMPOSER_MIN_HEIGHT ? prev : COMPOSER_MIN_HEIGHT));
                setComposerScrollable(false);
                return;
              }
              const contentHeight = event.nativeEvent.contentSize.height ?? COMPOSER_MIN_HEIGHT;
              const measured = Math.ceil(contentHeight);

              if (Platform.OS === 'ios') {
                setComposerScrollable((prev) => {
                  const nextScrollable = measured >= COMPOSER_MAX_HEIGHT - 1;
                  return prev === nextScrollable ? prev : nextScrollable;
                });
                return;
              }

              const nextHeight = Math.min(
                COMPOSER_MAX_HEIGHT,
                Math.max(COMPOSER_MIN_HEIGHT, measured),
              );
              setComposerHeight((prev) => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
              setComposerScrollable((prev) => {
                const nextScrollable = measured >= COMPOSER_MAX_HEIGHT - 1;
                return prev === nextScrollable ? prev : nextScrollable;
              });
            }}
            scrollEnabled={composerScrollable}
            accessibilityLabel={t('chat.input.accessibility')}
            className="px-1.5"
            style={{
              color: colors.textPrimary,
              fontSize: 13,
              lineHeight: 18,
              height: Platform.OS === 'ios' ? undefined : composerHeight,
              minHeight: COMPOSER_MIN_HEIGHT,
              maxHeight: COMPOSER_MAX_HEIGHT,
              paddingTop: COMPOSER_VERTICAL_PADDING,
              paddingBottom: COMPOSER_VERTICAL_PADDING,
              textAlignVertical: 'top',
              paddingRight: isAuthenticated ? 8 : 46,
            }}
          />

          <PromptSuggestionsModal
            visible={promptSuggestionsVisible}
            suggestions={promptSuggestions}
            loading={isPromptSuggestionsLoading}
            onClose={closePromptSuggestions}
            onSelectSuggestion={applyPromptSuggestion}
          />

          {isAuthenticated && attachedAssets.length ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap gap-1.5 px-1">
              {attachedAssets.map((asset) => (
                <View
                  key={asset.id}
                  className="flex-row items-center rounded-full border px-2 py-0.5"
                  style={{ borderColor: colors.border }}
                >
                  {(asset.mimeType ?? '').toLowerCase().startsWith('image/') ? (
                    <Pressable
                      onPress={() => setImageLightboxUri(asset.uri)}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview attached image: ${asset.label}`}
                      accessibilityHint="Opens a full-screen preview of this image."
                      className="rounded-full py-0.5"
                    >
                      <Text numberOfLines={1} style={{ maxWidth: 140, color: colors.textSecondary, fontSize: 10 }}>
                        {asset.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`Attached file: ${asset.label}`}
                      numberOfLines={1}
                      style={{ maxWidth: 140, color: colors.textSecondary, fontSize: 10 }}
                    >
                      {asset.label}
                    </Text>
                  )}
                  <Pressable
                    onPress={() => removeAttachment(asset.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('chat.removeAttachment')}: ${asset.label}`}
                    accessibilityHint="Removes this file from your message."
                    className="ml-1 rounded-full p-0.5"
                  >
                    <Ionicons name="close" size={12} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {screenMode === 'chat' && isAuthenticated && composerMediaReference ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap gap-1.5 px-1">
              <View
                className="flex-row items-center rounded-full border px-2 py-0.5"
                style={{ borderColor: colors.primary, backgroundColor: isDark ? '#121A2A' : '#EAF2FF' }}
              >
                <Pressable
                  onPress={() => jumpToReferencedMedia(composerMediaReference)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.reference.composerA11yLabel', { kind: composerMediaReference.kind })}
                  accessibilityHint={t('chat.reference.jumpA11yHint')}
                  accessibilityLiveRegion="polite"
                  className="flex-row items-center"
                >
                  <Ionicons name={composerMediaReference.kind === 'image' ? 'image-outline' : 'videocam-outline'} size={12} color={colors.primary} />
                  <Text numberOfLines={1} style={{ maxWidth: 180, color: colors.primary, fontSize: 10, marginLeft: 6 }}>
                    {t('chat.reference.composerChip', { kind: composerMediaReference.kind })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setComposerMediaReference(null);
                    announceForA11y(t('chat.reference.removed'));
                    hapticSelection();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.reference.removeA11yLabel', { kind: composerMediaReference.kind })}
                  accessibilityHint={t('chat.reference.removeA11yHint')}
                  className="ml-1 rounded-full p-0.5"
                >
                  <Ionicons name="close" size={12} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {dedicatedComposerHelperText ? (
            <View
              className="mx-1 mb-1 mt-1 rounded-xl border px-2 py-1"
              style={{
                borderColor: `${colors.primary}33`,
                backgroundColor: isDark ? 'rgba(95,127,184,0.10)' : 'rgba(95,127,184,0.08)',
              }}
            >
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.textSecondary, fontSize: 9, lineHeight: 12 }}
              >
                {dedicatedComposerHelperText}
              </Text>
            </View>
          ) : null}

          {isAuthenticated ? (
            <View className=" flex-row items-center justify-between px-0.5 pb-0.5">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={toggleRecording}
                  onLongPress={(event) =>
                    showTooltip(isRecording ? t('chat.tooltip.micStop') : t('chat.tooltip.micStart'), event)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? t('chat.mic.stop') : t('chat.mic.start')}
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{
                    borderColor: isRecording ? '#DC2626' : colors.border,
                    backgroundColor: isRecording ? '#DC2626' : 'transparent',
                  }}
                >
                  <Ionicons
                    name={isRecording ? 'stop' : 'mic-outline'}
                    size={14}
                    color={isRecording ? '#FFFFFF' : colors.textPrimary}
                  />
                </Pressable>

                <View>
                  <Pressable
                    ref={uploadTriggerButtonRef}
                    onPress={() => {
                      hapticSelection();
                      if (screenMode === 'image-to-video' || screenMode === 'edit-image') {
                        handleUploadImagePress();
                      } else {
                        setAttachmentMenuOpen((prev) => !prev);
                      }
                    }}
                    onLongPress={(event) =>
                      showTooltip(
                        screenMode === 'image-to-video' || screenMode === 'edit-image'
                          ? screenConfig.attachImageLabel
                          : t('chat.tooltip.attach'),
                        event
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? screenConfig.attachImageLabel
                        : screenConfig.uploadTriggerLabel
                    }
                    accessibilityHint={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? screenConfig.attachImageHint
                        : attachmentMenuOpen
                        ? 'Closes upload options.'
                        : screenConfig.uploadTriggerHint
                    }
                    accessibilityState={{
                      expanded: screenMode === 'image-to-video' || screenMode === 'edit-image' ? undefined : attachmentMenuOpen,
                    }}
                    className={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? "h-8 px-3 flex-row items-center justify-center rounded-full border"
                        : "h-8 w-8 items-center justify-center rounded-full border"
                    }
                    style={{ borderColor: colors.border }}
                    >
                      <Ionicons
                        name={screenMode === 'image-to-video' || screenMode === 'edit-image' ? 'image-outline' : 'attach-outline'}
                        size={14}
                      color={colors.textPrimary}
                    />
                    {screenMode === 'image-to-video' || screenMode === 'edit-image' ? (
                      <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>
                        Upload image
                      </Text>
                    ) : null}
                  </Pressable>
                </View>

              </View>

              <Pressable
                onPress={() => handleSend()}
                onLongPress={(event) => showTooltip(t('chat.send'), event)}
                disabled={isSendDisabled}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                accessibilityHint={t('chat.sendHint')}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isSendDisabled ? '#5F7FB8' : colors.primary,
                }}
              >
                <Ionicons name="send" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => handleSend()}
              onLongPress={(event) => showTooltip(t('chat.send'), event)}
              disabled={isSendDisabled}
              accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                accessibilityHint={t('chat.sendHint')}
                className="absolute bottom-2 right-2 h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isSendDisabled ? '#5F7FB8' : colors.primary,
                }}
              >
              <Ionicons name="send" size={15} color="#FFFFFF" />
            </Pressable>
          )}

          {isRecording ? (
            <Animated.View
              entering={FadeInDown.duration(MOTION.duration.quick)}
              className="mt-1 flex-row items-center rounded-xl border px-2.5 py-1.5"
              style={{ borderColor: `${colors.primary}99`, backgroundColor: `${colors.primary}17` }}
            >
              <RecordingWaves color={colors.primary} />
            </Animated.View>
          ) : null}
            </Animated.View>

            {!!statusNotice ? (
              <Animated.View
                entering={FadeInUp.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                pointerEvents={upgradeNoticeKind ? 'auto' : 'none'}
                className="absolute left-3 right-3 rounded-2xl border px-3 py-2"
                style={{
                  bottom: 102 + composerBottomInset,
                  borderColor: upgradeNoticeKind === 'image'
                    ? '#8B5CF6'
                    : upgradeNoticeKind === 'video'
                      ? '#F97316'
                      : colors.primary,
                  backgroundColor: upgradeNoticeKind === 'image'
                    ? (isDark ? 'rgba(38,24,62,0.98)' : 'rgba(250,245,255,0.98)')
                    : upgradeNoticeKind === 'video'
                      ? (isDark ? 'rgba(55,29,16,0.98)' : 'rgba(255,247,237,0.98)')
                      : (isDark ? 'rgba(23,23,28,0.96)' : 'rgba(255,255,255,0.98)'),
                }}
              >
                <View className="flex-row items-start">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: upgradeNoticeKind === 'image'
                        ? 'rgba(139,92,246,0.16)'
                        : upgradeNoticeKind === 'video'
                          ? 'rgba(249,115,22,0.16)'
                          : `${colors.primary}20`,
                    }}
                  >
                    <Ionicons
                      name={upgradeNoticeKind === 'image'
                        ? 'image-outline'
                        : upgradeNoticeKind === 'video'
                          ? 'videocam-outline'
                          : upgradeNoticeKind === 'chat'
                            ? 'chatbubbles-outline'
                            : 'information-circle-outline'}
                      size={16}
                      color={upgradeNoticeKind === 'image' ? '#8B5CF6' : upgradeNoticeKind === 'video' ? '#F97316' : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 9 }}>
                    {upgradeNoticeKind ? (
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {upgradeNoticeKind === 'image'
                          ? 'Image limit reached'
                          : upgradeNoticeKind === 'video'
                            ? 'Video limit reached'
                            : 'Chat limit reached'}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.textPrimary, fontSize: 12, marginTop: upgradeNoticeKind ? 2 : 0, lineHeight: 17 }}>
                      {statusNotice}
                    </Text>
                    {upgradeNoticeKind && upgradeNoticeResetHours !== null ? (
                      <View
                        className="mt-2 self-start rounded-full px-2.5 py-1"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                          Resets in {formatLimitResetDuration(upgradeNoticeResetHours)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {upgradeNoticeKind ? (
                  <View className="mt-2 flex-row items-center gap-2">
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        setStatusNotice('');
                        setUpgradeNoticeKind(null);
                        setUpgradeNoticeResetHours(null);
                        router.push('/plans');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.limit.upgradeCta')}
                      className="h-8 items-center justify-center rounded-full px-3"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                        {t('chat.limit.upgradeCta')}
                      </Text>
                    </Pressable>
                    {Platform.OS === 'ios' && isAuthenticated ? (
                      <Pressable
                        onPress={() => {
                          hapticSelection();
                          void restorePurchasesAndSyncFromLimitNotice();
                        }}
                        disabled={isLimitRestoreSyncing}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.limit.restoreSync')}
                        className="h-8 items-center justify-center rounded-full px-3"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.primary,
                          opacity: isLimitRestoreSyncing ? 0.7 : 1,
                        }}
                      >
                        {isLimitRestoreSyncing ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                            {t('chat.limit.restoreSync')}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        setStatusNotice('');
                        setUpgradeNoticeKind(null);
                        setUpgradeNoticeResetHours(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.limit.dismiss')}
                      className="h-8 items-center justify-center rounded-full px-3"
                      style={{ borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                        {t('chat.limit.dismiss')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {!!downloadToastNotice ? (
              <Animated.View
                entering={ZoomIn.duration(MOTION.duration.quick)}
                exiting={ZoomOut.duration(MOTION.duration.quick)}
                pointerEvents="none"
                className="absolute left-3 right-3 rounded-2xl border px-3 py-2.5"
                style={{
                  bottom: 154 + composerBottomInset,
                  borderColor: '#22C55E',
                  backgroundColor: isDark ? 'rgba(6,78,59,0.95)' : 'rgba(236,253,245,0.98)',
                }}
              >
                <View className="flex-row items-center">
                  <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}>
                    <Ionicons name="checkmark-done" size={14} color="#22C55E" />
                  </View>
                  <Text style={{ color: isDark ? '#D1FAE5' : '#065F46', fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                    {downloadToastNotice}
                  </Text>
                  <Ionicons name="download-outline" size={14} color="#22C55E" style={{ marginLeft: 'auto' }} />
                </View>
              </Animated.View>
            ) : null}

            {tooltipState ? (
              <Animated.View
                entering={FadeIn.duration(MOTION.duration.quick)}
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
          </View>
      </KeyboardAvoidingView>
      <AppPromptModal
        visible={documentFormWarningVisible}
        title="Unfinished form"
        message="You still have a document form open. You can continue with your new prompt, and the unfinished form will collapse so you can reopen it later."
        confirmLabel="Continue anyway"
        cancelLabel="Keep filling form"
        iconName="document-text-outline"
        onCancel={() => setDocumentFormWarningVisible(false)}
        onConfirm={() => {
          setDocumentFormWarningVisible(false);
          handleSend({ skipDocumentFormWarning: true });
        }}
      />
    </AppScreen>
  );
}
