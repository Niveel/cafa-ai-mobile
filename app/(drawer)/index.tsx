import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import {
  type GestureResponderEvent,
  AccessibilityInfo,
  ActivityIndicator,
  Dimensions,
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
import * as Clipboard from 'expo-clipboard';
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
  CHAT_MODEL_OPTIONS,
  GUEST_TTS_RATE,
  ImageGenerationPlaceholder,
  ImageMessageActionsRow,
  MessageActionsRow,
  RecordingWaves,
  extractImagePrompt,
  extractVideoPrompt,
  resolveModelBadgeLabel,
  UserPromptActionsRow,
  VideoGenerationPlaceholder,
  createStarterPromptCycler,
  createIdempotencyKey,
  getPromptTitle,
  isLikelyImageFollowUpPrompt,
  isLikelyVideoGenerationIntent,
  isLikelyVideoFollowUpPrompt,
  isMediaGenerationPrompt,
  type AttachedAsset,
  type UiMessage,
  type UiMessageAttachment,
} from '@/components';
import { useAppContext } from '@/context';
import { useRevenueCat } from '@/context/RevenueCatContext';
import {
  createAuthenticatedConversation,
  createGuestConversation,
  ensureGuestSession,
  generateImage,
  syncSubscriptionState,
  getSubscriptionOverview,
  getAuthenticatedConversation,
  getGuestConversation,
  listAuthenticatedConversations,
  listGuestConversations,
  getVoiceCatalog,
  pollVideoJob,
  sendAuthenticatedMessageStream,
  sendAuthenticatedMessageNonStream,
  sendGuestMessageStream,
  startVideoGeneration,
  startVideoGenerationFromImage,
  synthesizeVoice,
  toggleAuthenticatedMessageReaction,
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { emitChatMutated, getAccessToken, getDefaultVoicePreference } from '@/services';
import {
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
  launchImageLibraryAsync: (options: {
    allowsEditing: boolean;
    quality: number;
    mediaTypes: string[];
  }) => Promise<{
    canceled: boolean;
    assets?: { fileName?: string | null; uri: string; mimeType?: string | null }[];
  }>;
};

type DocumentPickerModule = {
  getDocumentAsync: (options: {
    copyToCacheDirectory: boolean;
    multiple: boolean;
    type: string[];
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

let expoAudioModulePromise: Promise<ExpoAudioModule> | null = null;
let imagePickerModulePromise: Promise<ImagePickerModule> | null = null;
let documentPickerModulePromise: Promise<DocumentPickerModule> | null = null;
let sharingModulePromise: Promise<unknown> | null = null;
let webBrowserModulePromise: Promise<ExpoWebBrowserModule> | null = null;

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
  if (!imagePickerModulePromise) {
    imagePickerModulePromise = import('expo-image-picker') as Promise<ImagePickerModule>;
  }

  try {
    return await imagePickerModulePromise;
  } catch {
    imagePickerModulePromise = null;
    throw new Error('Image picker is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getDocumentPickerModule() {
  if (!documentPickerModulePromise) {
    documentPickerModulePromise = import('expo-document-picker') as Promise<DocumentPickerModule>;
  }

  try {
    return await documentPickerModulePromise;
  } catch {
    documentPickerModulePromise = null;
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

export default function ChatScreen() {
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
  const createWelcomeMessage = useCallback(
    (): UiMessage => ({
      id: 'welcome-1',
      role: 'assistant',
      content: t('chat.welcome'),
      createdAt: Date.now(),
    }),
    [t],
  );
  const params = useLocalSearchParams<{ conversationId?: string; newChat?: string }>();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
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
  const [isLimitRestoreSyncing, setIsLimitRestoreSyncing] = useState(false);
  const [guestUpsellVisible, setGuestUpsellVisible] = useState(false);
  const [downloadToastNotice, setDownloadToastNotice] = useState('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [sharingMediaMessageId, setSharingMediaMessageId] = useState<string | null>(null);
  const [composerMediaReference, setComposerMediaReference] = useState<ComposerMediaReference | null>(null);
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
  const canAttachDocuments = isAuthenticated && (authUser?.subscriptionTier ?? 'free') !== 'free';
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const messagesListRef = useRef<FlashListRef<UiMessage>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const inputValueRef = useRef('');
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
  const voiceNameByIdRef = useRef<Record<string, string>>({});
  const videoGenerationInFlightRef = useRef(false);
  const videoFromImageInFlightRef = useRef(false);
  const videoAutoSyncInFlightRef = useRef(false);
  const lastVideoGenerationStartAtRef = useRef(0);
  const isSendRunInFlightRef = useRef(false);
  const lastSendAttemptAtRef = useRef(0);
  const sendAttemptSeqRef = useRef(0);
  const lastHandledNewChatTokenRef = useRef<string | null>(null);
  const initialNewChatTokenRef = useRef<string | null>(null);
  const starterPromptCyclerRef = useRef(createStarterPromptCycler());
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
  const composerPlaceholder = useMemo(() => t('chat.input.placeholder'), [t]);
  const isWelcomeMessage = useCallback((message: UiMessage) => message.id === 'welcome-1', []);
  const isFreshChatState = messages.length === 1 && isWelcomeMessage(messages[0]);
  const announceForA11y = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);
  const rotateStarterPrompts = useCallback(() => {
    const selected = starterPromptCyclerRef.current();
    if (selected.length) {
      setStarterPrompts(selected);
    }
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
    hapticSelection();
    showTransientNotice(t('chat.reference.jumpSuccess'));
  };

  const logSendPayload = useCallback((payload: Record<string, unknown>) => {
    if (!__DEV__) return;
    try {
      console.log('[chat-send:payload]', JSON.stringify(payload));
    } catch {
      console.log('[chat-send:payload]', payload);
    }
  }, []);

  useEffect(() => {
    rotateStarterPrompts();
  }, [rotateStarterPrompts]);

  useEffect(() => {
    // Avoid remounting TextInput on iOS to update placeholder text; remounting can
    // cause focus jitter with keyboard frame callbacks.
    composerInputRef.current?.setNativeProps?.({
      placeholder: composerPlaceholder,
    });
  }, [composerPlaceholder]);

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

  const isPdfAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return mime.includes('application/pdf') || name.endsWith('.pdf');
  }, []);

  const isMarkdownAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return mime.includes('text/markdown') || name.endsWith('.md') || name.endsWith('.markdown');
  }, []);

  const isGeneratedDownloadableFileAttachment = useCallback((attachment: UiMessageAttachment) => (
    Boolean(attachment.url) && (isPdfAttachment(attachment) || isMarkdownAttachment(attachment))
  ), [isMarkdownAttachment, isPdfAttachment]);

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

    return {
      id: message.id,
      role,
      content: message.content,
      createdAt: createdAtMs,
      referencedMedia,
      tokens: message.tokens,
      attachments: (message.attachments ?? []).map((attachment) => ({
        ...attachment,
        url: resolveBackendAssetUrl(attachment.url) ?? attachment.url,
        thumbnailUrl: resolveBackendAssetUrl(attachment.thumbnailUrl) ?? attachment.thumbnailUrl,
      })),
      imageUrl: resolveBackendAssetUrl(message.imageUrl) ?? undefined,
      imagePrompt: message.imagePrompt,
      imageId: message.imageId,
      videoUrl: resolveBackendAssetUrl(message.videoUrl) ?? undefined,
      videoPrompt: message.videoPrompt,
      videoId: message.videoId,
    };
  }, [resolveBackendAssetUrl]);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  };

  const waitForVideoGeneration = useCallback(async (jobId: string) => {
    for (let attempt = 0; attempt < VIDEO_JOB_POLL_ATTEMPTS; attempt += 1) {
      try {
        const status = await pollVideoJob(jobId);
        if (status.status === 'completed') {
          const resolvedVideoUrl = resolveBackendAssetUrl(status.result?.videoUrl ?? status.videoUrl);
          return {
            videoId: status.result?.id,
            videoPrompt: status.result?.prompt,
            videoUrl: resolvedVideoUrl,
          };
        }
        if (status.status === 'failed') {
          throw new Error(status.error || status.message || 'Video generation failed.');
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

    const pendingError = new Error('Video generation is still processing.');
    (pendingError as Error & { code?: string }).code = 'VIDEO_GENERATION_PENDING';
    throw pendingError;
  }, [resolveBackendAssetUrl]);

  const applyAuthConversationDetail = useCallback((detail: Awaited<ReturnType<typeof getAuthenticatedConversation>>) => {
    setMessages(detail.messages.map(mapAuthMessageToUiMessage));
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
  }, [mapAuthMessageToUiMessage]);

  const syncAssistantMessageAfterStream = useCallback(async (
    conversationId: string,
    assistantMessageId: string,
    localFallbackId: string,
  ) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const detail = await getAuthenticatedConversation(conversationId, { force: true });
        const serverMessage = detail.messages.find(
          (message) => message.id === assistantMessageId && message.role === 'assistant',
        );

        if (serverMessage) {
          const mapped = mapAuthMessageToUiMessage(serverMessage);
          setMessages((prev) => {
            const byServerId = prev.findIndex((item) => item.id === assistantMessageId);
            if (byServerId >= 0) {
              const next = [...prev];
              next[byServerId] = mapped;
              return next;
            }

            const byFallbackId = prev.findIndex((item) => item.id === localFallbackId);
            if (byFallbackId >= 0) {
              const next = [...prev];
              next[byFallbackId] = mapped;
              return next;
            }

            return prev;
          });

          const hasVisualOrFileState = Boolean(mapped.imageUrl || mapped.videoUrl || (mapped.attachments?.length ?? 0) > 0);
          if (hasVisualOrFileState) return;
        }
      } catch {
        // Best-effort sync; keep the streamed state if server sync fails.
      }

      await new Promise((resolve) => setTimeout(resolve, 220));
    }
  }, [mapAuthMessageToUiMessage]);

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
    if (code === 'DAILY_LIMIT_EXCEEDED' || code === 'GUEST_DAILY_LIMIT_EXCEEDED' || code === 'UPGRADE_REQUIRED') {
      return true;
    }
    return message.includes('limit') || message.includes('quota') || message.includes('upgrade required');
  };

  const isRateLimitedError = (error: unknown) => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
    return typed?.status === 429 || code.includes('RATE_LIMIT') || message.includes('too many');
  };

  const getLimitNoticeMessage = useCallback((kind: 'chat' | 'image' | 'video') => {
    if (kind === 'image') return t('chat.limit.imageReached');
    if (kind === 'video') return t('chat.limit.videoReached');
    return t('chat.limit.chatReached');
  }, [t]);

  const formatTierLabel = useCallback((tier: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max') => {
    if (tier === 'cafa_smart') return 'Cafa Smart';
    if (tier === 'cafa_pro') return 'Cafa Pro';
    if (tier === 'cafa_max') return 'Cafa Max';
    return 'Free';
  }, []);

  const showLimitNotice = useCallback((kind: 'chat' | 'image' | 'video') => {
    setUpgradeNoticeKind(kind);
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
    if (typed?.status === 403 || code === 'FORBIDDEN' || code === 'UPGRADE_REQUIRED' || message === 'forbidden') {
      return 'You do not have permission for this action on your current plan.';
    }
    if (
      typed?.status === 429
      || code.includes('RATE_LIMIT')
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
                color: colors.primary,
                textDecorationLine: 'underline',
                fontWeight: '600',
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
  }, [colors.primary, colors.textPrimary, isDark, openInAppBrowser]);

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

    const normalized = content.replace(/\r\n/g, '\n');
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
        <Text key={`p-${key}`} style={{ color: textColor, lineHeight: 20 }}>
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
            <Text style={{ color: textColor, lineHeight: 20 }}>{'\u2022 '}</Text>
            <Text style={{ color: textColor, lineHeight: 20, flex: 1 }}>
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
            <Text style={{ color: textColor, lineHeight: 20 }}>{`${orderedMatch[1]}. `}</Text>
            <Text style={{ color: textColor, lineHeight: 20, flex: 1 }}>
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
            <Text style={{ color: textColor, lineHeight: 20 }}>
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
        <Text style={{ color: textColor, lineHeight: 20 }}>
          {content}
        </Text>
      );
    }
    return nodes;
  }, [colors.primary, colors.textPrimary, copiedCodeBlockId, isDark, normalizeCodeLanguage, renderHighlightedCode, renderInlineMarkdown]);

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

  const showDownloadToast = useCallback((message: string) => {
    setDownloadToastNotice(message);
    if (downloadToastTimeoutRef.current) clearTimeout(downloadToastTimeoutRef.current);
    downloadToastTimeoutRef.current = setTimeout(() => {
      setDownloadToastNotice('');
      downloadToastTimeoutRef.current = null;
    }, 2400);
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
    return item.role;
  }, []);

  const handleSend = () => {
    const run = async () => {
      const trimmed = inputValueRef.current.trim();
      const attachmentsForSend = [...attachedAssets];
      const attemptId = ++sendAttemptSeqRef.current;
      const now = Date.now();
      const sinceLastAttemptMs = now - lastSendAttemptAtRef.current;
      const SEND_DEBOUNCE_MS = 450;

      if (!trimmed && attachmentsForSend.length === 0) {
        return;
      }

      if (sinceLastAttemptMs < SEND_DEBOUNCE_MS) {
        return;
      }

      if (isSendRunInFlightRef.current || isSending) {
        return;
      }
      lastSendAttemptAtRef.current = now;
      isSendRunInFlightRef.current = true;

      let lastEndpoint = `${API_BASE_URL}/chat`;
      let lastIdempotencyKey = '';
      let activeAuthConversationId: string | null = null;
      let requestKind: 'chat' | 'image' | 'video' = 'chat';
      let usedVideoReferenceFollowUp = false;
      let requestedVideoPrompt = '';
      let requestedVideoConversationId = '';
      let requestedVideoStartedAt = 0;
      let didMutateChats = false;
      const sendStartedAt = Date.now();
      let responseLogEmitted = false;
      let assistantResponseBuffer = '';
      const logParsedResponseForAttempt = (raw: string) => {
        if (responseLogEmitted) return;
        const parsedText = raw.trim();
        if (!parsedText) return;
        responseLogEmitted = true;
      };

      const userMessage: UiMessage = {
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
      if (composerMediaReference) {
        pendingReferencedUserMessagesRef.current.push({
          sentAt: userMessage.createdAt,
          content: trimmed,
          reference: { ...composerMediaReference },
        });
      }

      const assistantId = `assistant-${Date.now()}`;
      let activeAssistantId = assistantId;

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
      setIsSending(true);
      setStatusNotice('');
      setStreamingModelLabel(t(`chat.model.label.${activeModel}`));
      setMessages((prev) => {
        const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
        return [
          ...withoutSyntheticWelcome,
          userMessage,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: Date.now(),
          },
        ];
      });
      autoScrollEnabledRef.current = true;
      setShowScrollToBottom(false);
      scrollToBottom();

      try {
        if (!isAuthenticated) {
          if (isMediaGenerationPrompt(trimmed)) {
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
                queueAssistantDelta(assistantId, event.content);
              }
              if (event.type === 'done') {
                flushPendingAssistantDelta();
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

        const extractedVideoPrompt = extractVideoPrompt(trimmed);
        const extractedImagePrompt = extractImagePrompt(trimmed);
        const imageAttachmentForVideoIntent = attachmentsForSend.find((asset) =>
          (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
        );
        const inferredVideoFromImagePrompt =
          !extractedVideoPrompt && imageAttachmentForVideoIntent && isLikelyVideoGenerationIntent(trimmed)
            ? trimmed
            : null;
        const effectiveVideoPrompt = extractedVideoPrompt ?? inferredVideoFromImagePrompt;
        const referencedKind = composerMediaReference?.kind;
        const shouldUseVideoFollowUp =
          referencedKind === 'video' && isLikelyVideoFollowUpPrompt(trimmed);
        const shouldUseImageFollowUp =
          referencedKind === 'image' && isLikelyImageFollowUpPrompt(trimmed);
        const shouldUseReferencedNonStreamChat =
          Boolean(composerMediaReference)
          && !shouldUseVideoFollowUp
          && !shouldUseImageFollowUp
          && !effectiveVideoPrompt
          && !extractedImagePrompt;

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
          await sendAuthenticatedMessageNonStream(conversationId, trimmed, activeModel, composerMediaReference ?? undefined);
          const detail = await getAuthenticatedConversation(conversationId, { force: true });
          applyAuthConversationDetail(detail);
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

        if (extractedImagePrompt) {
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
            throw new Error('Image generated but no image URL was returned.');
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
        logSendPayload({
          endpoint: lastEndpoint,
          mode: 'auth-stream-chat',
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
              queueAssistantDelta(activeAssistantId, event.content);
              return;
            }

            if (event.type === 'done') {
              flushPendingAssistantDelta();
              hapticSuccess();
              setStreamingModelLabel(null);
              logParsedResponseForAttempt(assistantResponseBuffer);
              if (event.messageId) {
                const previousAssistantId = activeAssistantId;
                activeAssistantId = event.messageId;
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === previousAssistantId
                      ? { ...message, id: event.messageId!, tokens: event.tokens }
                      : message,
                  ),
                );
                void syncAssistantMessageAfterStream(conversationId, event.messageId, previousAssistantId);
                return;
              }
              void syncAssistantMessageAfterStream(conversationId, activeAssistantId, assistantId);
            }
          },
          language,
          activeModel,
          (debugEvent) => {
            lastIdempotencyKey = debugEvent.idempotencyKey;
          },
        );
        await reconcileAuthConversationAfterSend(conversationId);
        didMutateChats = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('chat.sendFailed');
        const friendlyMessage = getFriendlyErrorMessage(error, requestKind);
        const code = ((error as { code?: string } | undefined)?.code ?? '').toUpperCase();
        const status = (error as { status?: number } | undefined)?.status;
        const rawErrorMessage = (error as { message?: string } | undefined)?.message ?? '';
        const normalizedErrorMessage = rawErrorMessage.toLowerCase();
        const isLimitError = isLimitOrUpgradeError(error);
        const isRateLimited = isRateLimitedError(error);
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
            || message.toLowerCase().includes('too many video generation requests')
            || message.toLowerCase().includes('too many requests')
          );
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
        if (isAuthenticated && attachmentsForSend.length) {
          setAttachedAssets(attachmentsForSend);
        }
        if (requestKind === 'video') {
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
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
                  && new Date(item.createdAt).getTime() >= sendStartedAt - 5000
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
        if (
          isAuthenticated
          && requestKind === 'chat'
          && code === 'AUTH_STREAM_ACTIVE_SERVER_ERROR'
          && attachmentsForSend.length > 0
          && activeAuthConversationId
        ) {
          try {
            await sendAuthenticatedMessageNonStream(
              activeAuthConversationId,
              trimmed,
              activeModel,
              composerMediaReference ?? undefined,
              attachmentsForSend,
            );
            const detail = await getAuthenticatedConversation(activeAuthConversationId, { force: true });
            applyAuthConversationDetail(detail);
            hapticSuccess();
            didMutateChats = true;
            return;
          } catch {
            // Fall through to normal error handling.
          }
        }
        if (isAuthenticated && (isAuthStreamTransportError || isIdempotencyInProgress)) {
          const recoveryConversationId = activeAuthConversationId ?? authConversationId;
          if (recoveryConversationId) {
            for (let recoveryAttempt = 1; recoveryAttempt <= 8; recoveryAttempt += 1) {
              try {
                await new Promise((resolve) => setTimeout(resolve, 280 * recoveryAttempt));
                const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
                const hasAssistantReply = detail.messages
                  .slice()
                  .reverse()
                  .some((item) => item.role === 'assistant' && item.content.trim().length > 0);
                if (!hasAssistantReply) continue;
                applyAuthConversationDetail(detail);
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= sendStartedAt - 2000
                  ));
                if (recoveredAssistant) {
                  logParsedResponseForAttempt(recoveredAssistant.content);
                }
                didMutateChats = true;
                return;
              } catch {
                // continue recovery retries
              }
            }
          }
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
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: delayedMessage,
                    videoPrompt: requestedVideoPrompt || item.videoPrompt,
                    isVideoGenerating: true,
                  }
                : item,
            ),
          );
          showTransientNotice(delayedMessage, 7000);
          didMutateChats = true;
          return;
        }
        if (isLimitError) {
          showLimitNotice(requestKind);
        }
        hapticError();
        setStreamingModelLabel(null);

        if (!isLimitError) {
          showTransientNotice(friendlyMessage, isRateLimited ? 5000 : 3200);
        }
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  isImageGenerating: false,
                  isVideoGenerating: false,
                  content: isLimitError ? getLimitNoticeMessage(requestKind) : friendlyMessage,
                }
              : item,
          ),
        );
      } finally {
        flushPendingAssistantDelta();
        if (deltaFlushTimerRef.current) {
          clearTimeout(deltaFlushTimerRef.current);
          deltaFlushTimerRef.current = null;
        }
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

  const pickAttachment = async () => {
    setAttachmentMenuOpen(false);
    let result: Awaited<ReturnType<ImagePickerModule['launchImageLibraryAsync']>>;
    try {
      const ImagePicker = await getImagePickerModule();
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.9,
        mediaTypes: ['images'],
      });
    } catch {
      showTransientNotice('Image picker is unavailable in this build.');
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fallbackFileName = `image-${Date.now()}.jpg`;
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
  };

  const pickDocumentAttachment = async () => {
    setAttachmentMenuOpen(false);
    if (!canAttachDocuments) {
      showTransientNotice('Document upload is available on paid plans only.');
      return;
    }

    let result: Awaited<ReturnType<DocumentPickerModule['getDocumentAsync']>>;
    try {
      const DocumentPicker = await getDocumentPickerModule();
      result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
      });
    } catch {
      showTransientNotice('Document picker is unavailable in this build.');
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
        mimeType: asset.mimeType ?? undefined,
      },
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  };

  const showTransientNotice = (message: string, durationMs = 3200) => {
    setUpgradeNoticeKind(null);
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
    showTransientNotice(t('chat.imageDownloadStarting'));

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
      showTransientNotice(t('chat.imageDownloadFailed'));
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
    showTransientNotice(t('chat.videoDownloadStarting'));

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
      showTransientNotice(t('chat.videoDownloadFailed'));
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
      const lowerName = (attachment.originalName ?? '').toLowerCase();
      const isMarkdown = isMarkdownAttachment(attachment);
      const fallbackExtension = isMarkdown ? 'md' : 'pdf';
      const suggestedName = (attachment.originalName?.trim() || `cafa-ai-file-${Date.now()}.${fallbackExtension}`)
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
      const finalName = /\.[a-z0-9]+$/i.test(suggestedName)
        ? suggestedName
        : `${suggestedName}.${lowerName.endsWith('.md') ? 'md' : fallbackExtension}`;
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
          mimeType: attachment.mimeType || (isMarkdown ? 'text/markdown' : 'application/pdf'),
        });
        showDownloadToast(`Saved to ${persisted.readableFilePath}`);
      } else {
        const Sharing = await getSharingModule();
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: attachment.mimeType || (isMarkdown ? 'text/markdown' : 'application/pdf'),
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

    const loadAuthenticatedState = async () => {
      try {
        const conversations = await listAuthenticatedConversations();
        if (!conversations.length) {
          setAuthConversationId(null);
          setMessages([createWelcomeMessage()]);
          rotateStarterPrompts();
          return;
        }

        const latest = [...conversations].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
        setAuthConversationId(latest.id);
        router.setParams({ conversationId: latest.id, newChat: undefined });

        const detail = await getAuthenticatedConversation(latest.id);
        if (!detail.messages.length) {
          setMessages([createWelcomeMessage()]);
          rotateStarterPrompts();
          setMessageReactions({});
          return;
        }

        setMessages(
          detail.messages.map(mapAuthMessageToUiMessage),
        );

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
      } catch (error) {
        showTransientNotice(getFriendlyErrorMessage(error, 'chat'));
        setMessages([createWelcomeMessage()]);
        rotateStarterPrompts();
      } finally {
        setIsHydratingAuthChat(false);
      }
    };

    setIsHydratingAuthChat(true);
    void loadAuthenticatedState();
  }, [createWelcomeMessage, getFriendlyErrorMessage, isAuthenticated, mapAuthMessageToUiMessage, rotateStarterPrompts]);

  useEffect(() => {
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const newChatToken = typeof params.newChat === 'string' ? params.newChat.trim() : '';
    if (initialNewChatTokenRef.current === null) {
      initialNewChatTokenRef.current = newChatToken || '';
    }
    const shouldStartNewChat =
      newChatToken.length > 0
      && newChatToken !== initialNewChatTokenRef.current
      && newChatToken !== lastHandledNewChatTokenRef.current;
    if (shouldStartNewChat) {
      lastHandledNewChatTokenRef.current = newChatToken;
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
    if (!targetConversationId) return;

    const hydrateTarget = async () => {
      try {
        if (isAuthenticated) {
          const detail = await getAuthenticatedConversation(targetConversationId, { force: true });
          setAuthConversationId(targetConversationId);
          if (!detail.messages.length) {
            setMessages([createWelcomeMessage()]);
            rotateStarterPrompts();
            setMessageReactions({});
            return;
          }
          setMessages(
            detail.messages.map(mapAuthMessageToUiMessage),
          );
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
        setGuestConversationId(targetConversationId);
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
        // Non-blocking for general chat flow.
      }
    };

    void hydrateTarget();
  }, [createWelcomeMessage, isAuthenticated, mapAuthMessageToUiMessage, params.conversationId, params.newChat, rotateStarterPrompts]);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
    setComposerMediaReference(null);
    setAuthConversationId(null);
    const loadGuestState = async () => {
      try {
        await ensureGuestSession();
        const conversations = await listGuestConversations();
        if (!conversations.length) return;

        const latest = [...conversations].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];

        setGuestConversationId(latest._id);
        const detail = await getGuestConversation(latest._id);
        if (!detail.messages?.length) return;
        setMessages(
          detail.messages.map((message) => ({
            id: message._id,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
            createdAt: new Date(message.createdAt).getTime(),
          })),
        );
      } catch {
        setMessages([createWelcomeMessage()]);
        rotateStarterPrompts();
      }
    };
    setMessages([createWelcomeMessage()]);
    rotateStarterPrompts();
    void loadGuestState();
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
          {CHAT_MODEL_OPTIONS.map((model) => {
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
                  Tap a starter prompt
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
              data={messages}
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
                const isImageMessage = !isUser && Boolean(item.imageUrl);
                const isVideoMessage = !isUser && Boolean(item.videoUrl);
                const hasAttachmentPreviews = imageAttachments.length > 0 || fileAttachments.length > 0;
                return (
                  <Animated.View entering={FadeInUp.duration(MOTION.duration.normal)} className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <View className="max-w-[88%]">
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

                      {!isImageGenerating && !isVideoGenerating && isImageMessage ? (
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
                      ) : null}

                      {!isImageGenerating && !isVideoGenerating && isVideoMessage ? (
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
                      ) : null}

                      {!isImageGenerating && !isVideoGenerating && !isImageMessage && !isVideoMessage && hasAttachmentPreviews ? (
                        <View className="mb-2 gap-1.5">
                          {imageAttachments.map((attachment, index) => {
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
                          })}

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

                      {!isImageGenerating && !isVideoGenerating && !isImageMessage && !isVideoMessage && (item.content.trim() || !hasAttachmentPreviews) ? (
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

                      {!isUser && !isImageGenerating && isImageMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
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

                      {!isUser && !isVideoGenerating && isVideoMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
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

                      {!isUser && !isImageMessage && !isVideoMessage && item.content.trim() ? (
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
          <TextInput
            ref={composerInputRef}
            value={input}
            onChangeText={(text) => {
              inputValueRef.current = text;
              setInput(text);
              if (!text) {
                setComposerHeight(COMPOSER_MIN_HEIGHT);
                setComposerScrollable(false);
              }
            }}
            placeholder={composerPlaceholder}
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

          {isAuthenticated && attachedAssets.length ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap gap-1.5 px-1">
              {attachedAssets.map((asset) => (
                <View
                  key={asset.id}
                  className="flex-row items-center rounded-full border px-2 py-0.5"
                  style={{ borderColor: colors.border }}
                >
                  <Text numberOfLines={1} style={{ maxWidth: 140, color: colors.textSecondary, fontSize: 10 }}>
                    {asset.label}
                  </Text>
                  <Pressable
                    onPress={() => removeAttachment(asset.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.removeAttachment')}
                    className="ml-1 rounded-full p-0.5"
                  >
                    <Ionicons name="close" size={12} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {isAuthenticated && composerMediaReference ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap gap-1.5 px-1">
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={t('chat.reference.composerA11yLabel', { kind: composerMediaReference.kind })}
                accessibilityHint={t('chat.reference.composerA11yHint')}
                accessibilityLiveRegion="polite"
                className="flex-row items-center rounded-full border px-2 py-0.5"
                style={{ borderColor: colors.primary, backgroundColor: isDark ? '#121A2A' : '#EAF2FF' }}
              >
                <Ionicons name={composerMediaReference.kind === 'image' ? 'image-outline' : 'videocam-outline'} size={12} color={colors.primary} />
                <Text numberOfLines={1} style={{ maxWidth: 180, color: colors.primary, fontSize: 10, marginLeft: 6 }}>
                  {t('chat.reference.composerChip', { kind: composerMediaReference.kind })}
                </Text>
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

                <View
                  style={{
                    zIndex: attachmentMenuOpen ? 120 : 1,
                    elevation: attachmentMenuOpen ? 30 : 0,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      setAttachmentMenuOpen((prev) => !prev);
                    }}
                    onLongPress={(event) => showTooltip(t('chat.tooltip.attach'), event)}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.tooltip.attach')}
                    className="h-8 w-8 items-center justify-center rounded-full border"
                    style={{ borderColor: colors.border }}
                  >
                    <Ionicons name="attach-outline" size={14} color={colors.textPrimary} />
                  </Pressable>

                  {attachmentMenuOpen ? (
                    <Animated.View
                      entering={FadeInDown.duration(MOTION.duration.normal)}
                      className="absolute bottom-9 left-0 z-30 min-w-[190px] rounded-lg border p-1"
                      style={{
                        zIndex: 80,
                        elevation: 24,
                        borderColor: colors.border,
                        backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF',
                      }}
                      onTouchStart={() => {
                        menuTouchRef.current = true;
                      }}
                    >
                      <Pressable onPress={pickAttachment} className="flex-row items-center rounded-md px-2 py-2">
                        <Ionicons name="image-outline" size={14} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>{t('chat.attachImage')}</Text>
                      </Pressable>
                      {canAttachDocuments ? (
                        <Pressable onPress={pickDocumentAttachment} className="flex-row items-center rounded-md px-2 py-2">
                          <Ionicons name="document-text-outline" size={14} color={colors.textPrimary} />
                          <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>{t('chat.attachDocument')}</Text>
                        </Pressable>
                      ) : null}
                    </Animated.View>
                  ) : null}
                </View>

              </View>

              <Pressable
                onPress={handleSend}
                onLongPress={(event) => showTooltip(t('chat.send'), event)}
                disabled={(!input.trim() && attachedAssets.length === 0) || isSending}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                accessibilityHint={t('chat.sendHint')}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: !input.trim() || isSending ? '#5F7FB8' : colors.primary,
                }}
              >
                <Ionicons name="send" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleSend}
              onLongPress={(event) => showTooltip(t('chat.send'), event)}
              disabled={(!input.trim() && attachedAssets.length === 0) || isSending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              accessibilityHint={t('chat.sendHint')}
              className="absolute bottom-2 right-2 h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: !input.trim() || isSending ? '#5F7FB8' : colors.primary,
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
                  borderColor: colors.primary,
                  backgroundColor: isDark ? 'rgba(23,23,28,0.96)' : 'rgba(255,255,255,0.98)',
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>
                    {statusNotice}
                  </Text>
                </View>
                {upgradeNoticeKind ? (
                  <View className="mt-2 flex-row items-center gap-2">
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        setStatusNotice('');
                        setUpgradeNoticeKind(null);
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
    </AppScreen>
  );
}
