import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import {
  type GestureResponderEvent,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard, 
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
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

import {
  AppScreen,
  ChatVideoCard,
  CHAT_MODEL_OPTIONS,
  GUEST_TTS_RATE,
  IMAGE_MODE_PROMPTS,
  ImageGenerationPlaceholder,
  ImageMessageActionsRow,
  MessageActionsRow,
  RecordingWaves,
  extractImagePrompt,
  extractVideoPrompt,
  resolveModelBadgeLabel,
  UserPromptActionsRow,
  VIDEO_MODE_PROMPTS,
  VideoGenerationPlaceholder,
  createIdempotencyKey,
  getPromptTitle,
  isMediaGenerationPrompt,
  type AttachedAsset,
  type UiMessage,
} from '@/components';
import { useAppContext } from '@/context';
import {
  createAuthenticatedConversation,
  createGuestConversation,
  ensureGuestSession,
  generateImage,
  getAuthenticatedConversation,
  getGuestConversation,
  listAuthenticatedConversations,
  listGuestConversations,
  getVoiceCatalog,
  pollVideoJob,
  sendAuthenticatedMessageStream,
  sendGuestMessageStream,
  startVideoGeneration,
  synthesizeVoice,
  toggleAuthenticatedMessageReaction,
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { emitChatMutated, getAccessToken, getDefaultVoicePreference } from '@/services';
import { MOTION, hapticError, hapticImpact, hapticSelection, hapticSuccess, saveMediaToCafaAlbum } from '@/utils';

export default function ChatScreen() {
  const ANDROID_KEYBOARD_CALIBRATION = 0;
  const IOS_COMPOSER_KEYBOARD_GAP = 6;
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAppContext();
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
  const quickPrompts = [t('chat.prompt.quick1'), t('chat.prompt.quick2'), t('chat.prompt.quick3')];
  const imageModePrompts = IMAGE_MODE_PROMPTS;
  const videoModePrompts = VIDEO_MODE_PROMPTS;
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
  const [composerHeight, setComposerHeight] = useState(34);
  const [androidComposerOffset, setAndroidComposerOffset] = useState(0);
  const [isIosKeyboardVisible, setIsIosKeyboardVisible] = useState(false);
  const [authConversationId, setAuthConversationId] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState('');
  const [upgradeNoticeKind, setUpgradeNoticeKind] = useState<'chat' | 'image' | 'video' | null>(null);
  const [downloadToastNotice, setDownloadToastNotice] = useState('');
  const [ttsToastNotice, setTtsToastNotice] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [readAloudSpeaker, setReadAloudSpeaker] = useState<string | null>(null);
  const [isReadAloudLoading, setIsReadAloudLoading] = useState(false);
  const [streamingDots, setStreamingDots] = useState('.');
  const [streamingModelLabel, setStreamingModelLabel] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesListRef = useRef<FlashListRef<UiMessage>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const inputValueRef = useRef('');
  const autoScrollEnabledRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const voiceNameByIdRef = useRef<Record<string, string>>({});
  const videoGenerationInFlightRef = useRef(false);
  const lastVideoGenerationStartAtRef = useRef(0);
  const lastPromptIndexRef = useRef<{ image: number; video: number }>({ image: -1, video: -1 });
  const hasStartedChat = messages.some((message) => message.role === 'user');
  const screenWidth = Dimensions.get('window').width;
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  const keyboardComposerOffset = androidComposerOffset;
  const safeBottomInset = Math.max(insets.bottom, 0);
  const composerBottomInset = keyboardComposerOffset > 0 ? keyboardComposerOffset : 0;
  const topPillBg = isDark ? 'rgba(16, 16, 20, 0.94)' : 'rgba(255, 255, 255, 0.96)';
  const topPillBorder = isDark ? 'rgba(124, 58, 237, 0.42)' : 'rgba(124, 58, 237, 0.3)';
  const dividerPill = isDark ? 'rgba(124, 58, 237, 0.38)' : 'rgba(124, 58, 237, 0.2)';

  const resolveBackendAssetUrl = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${backendOrigin}${rawUrl}`;
    return `${backendOrigin}/${rawUrl}`;
  }, [backendOrigin]);

  const mapAuthMessageToUiMessage = useCallback((message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    imageUrl?: string;
    imagePrompt?: string;
    imageId?: string;
    videoUrl?: string;
    videoPrompt?: string;
    videoId?: string;
  }): UiMessage => ({
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    createdAt: new Date(message.createdAt).getTime(),
    tokens: message.tokens,
    imageUrl: resolveBackendAssetUrl(message.imageUrl) ?? undefined,
    imagePrompt: message.imagePrompt,
    imageId: message.imageId,
    videoUrl: resolveBackendAssetUrl(message.videoUrl) ?? undefined,
    videoPrompt: message.videoPrompt,
    videoId: message.videoId,
  }), [resolveBackendAssetUrl]);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  };

  const waitForVideoGeneration = useCallback(async (jobId: string) => {
    const maxAttempts = 180;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }

    throw new Error('Video generation is still processing. Please check again shortly.');
  }, [resolveBackendAssetUrl]);

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

  const showLimitNotice = useCallback((kind: 'chat' | 'image' | 'video') => {
    setUpgradeNoticeKind(kind);
    setStatusNotice(getLimitNoticeMessage(kind));
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      setUpgradeNoticeKind(null);
      noticeTimeoutRef.current = null;
    }, 5200);
  }, [getLimitNoticeMessage]);

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

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, content: `${message.content}${pending}` } : message,
      ),
    );
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

      const chunk = pending.slice(0, 2);
      pendingDeltaRef.current = pending.slice(chunk.length);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === targetId ? { ...message, content: `${message.content}${chunk}` } : message,
        ),
      );

      deltaFlushTimerRef.current = null;
      if (pendingDeltaRef.current) {
        queueAssistantDelta(targetId, '');
      }
    }, 12);
  };

  const handleSend = () => {
    const run = async () => {
      const trimmed = inputValueRef.current.trim();
      if (!trimmed || isSending) return;
      let lastEndpoint = `${API_BASE_URL}/chat`;
      let requestKind: 'chat' | 'image' | 'video' = 'chat';
      const attachmentsForSend = [...attachedAssets];
      let didMutateChats = false;

      const userMessage: UiMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

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
      setIsSending(true);
      setStatusNotice('');
      setStreamingModelLabel(t(`chat.model.label.${activeModel}`));
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
        },
      ]);
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
                queueAssistantDelta(assistantId, event.content);
              }
              if (event.type === 'done') {
                flushPendingAssistantDelta();
                hapticSuccess();
                setStreamingModelLabel(null);
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
          didMutateChats = true;
        }

        const extractedVideoPrompt = extractVideoPrompt(trimmed);
        if (extractedVideoPrompt) {
          const fullVideoPrompt = trimmed;
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
          lastEndpoint = `${API_BASE_URL}/videos/generate`;
          const job = await startVideoGeneration({
            conversationId,
            prompt: fullVideoPrompt,
            aspectRatio: '16:9',
          });

          const resolvedVideo = await waitForVideoGeneration(job.jobId);

          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
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
          didMutateChats = true;
          return;
        }

        const extractedImagePrompt = extractImagePrompt(trimmed);
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
        await sendAuthenticatedMessageStream(conversationId, trimmed, attachmentsForSend, (event) => {
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
            queueAssistantDelta(activeAssistantId, event.content);
            return;
          }

          if (event.type === 'done') {
            flushPendingAssistantDelta();
            hapticSuccess();
            setStreamingModelLabel(null);
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
            }
          }
        }, language, activeModel);
        didMutateChats = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('chat.sendFailed');
        const isLimitError = isLimitOrUpgradeError(error);
        const isRateLimited = isRateLimitedError(error);
        if (isAuthenticated && attachmentsForSend.length) {
          setAttachedAssets(attachmentsForSend);
        }
        if (requestKind === 'video') {
          videoGenerationInFlightRef.current = false;
        }
        if (isLimitError) {
          showLimitNotice(requestKind);
        }
        console.log(`[chat-send:error] endpoint=${lastEndpoint} message="${message}"`);
        hapticError();
        setStreamingModelLabel(null);

        if (!isLimitError) {
          showTransientNotice(message, isRateLimited ? 5000 : 3200);
        }
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  isImageGenerating: false,
                  isVideoGenerating: false,
                  content: isLimitError
                    ? getLimitNoticeMessage(requestKind)
                    : message.includes('GUEST_DAILY_LIMIT_EXCEEDED')
                      ? t('chat.limitReached')
                      : message,
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
        if (didMutateChats) {
          emitChatMutated();
        }
      }
    };

    void run();
  };

  const applyRandomPrompt = (kind: 'image' | 'video') => {
    const pool = kind === 'image' ? imageModePrompts : videoModePrompts;
    if (pool.length === 0) return;
    let pickedIndex = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && pickedIndex === lastPromptIndexRef.current[kind]) {
      pickedIndex = (pickedIndex + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    lastPromptIndexRef.current[kind] = pickedIndex;
    const picked = pool[pickedIndex];
    inputValueRef.current = picked;
    setInput(picked);
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
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.9,
      mediaTypes: ['images'],
    });

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
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: false,
      multiple: false,
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
      ],
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const lowerName = (asset.name ?? '').toLowerCase();
    const mime = (asset.mimeType ?? '').toLowerCase();
    const isAllowedMime =
      mime === 'application/pdf' ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'text/plain' ||
      mime === 'application/rtf';
    const isAllowedExtension =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.rtf');

    if (!isAllowedMime && !isAllowedExtension) {
      showTransientNotice('Only text documents are supported: PDF, DOC, DOCX, TXT, RTF.');
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

        const playChunk = (index: number) => {
          if (activeReadAloudRequestRef.current !== requestId) return;
          const target = ttsFilesRef.current[index];
          if (!target) {
            stopReadAloudPlayback();
            return;
          }
          if (index === 0) {
            setIsReadAloudLoading(false);
          }
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
            playChunk(index + 1);
          });
          player.play();
        };

        playChunk(0);
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
    setGuestConversationId(null);

    const loadAuthenticatedState = async () => {
      try {
        const conversations = await listAuthenticatedConversations();
        if (!conversations.length) {
          setAuthConversationId(null);
          setMessages([createWelcomeMessage()]);
          return;
        }

        const latest = [...conversations].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
        setAuthConversationId(latest.id);

        const detail = await getAuthenticatedConversation(latest.id);
        if (!detail.messages.length) return;

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
        const message = error instanceof Error ? error.message : t('drawer.loadingChats');
        showTransientNotice(message);
        setMessages([createWelcomeMessage()]);
      } finally {
        setIsHydratingAuthChat(false);
      }
    };

    setIsHydratingAuthChat(true);
    void loadAuthenticatedState();
  }, [createWelcomeMessage, isAuthenticated, mapAuthMessageToUiMessage, t]);

  useEffect(() => {
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const shouldStartNewChat = typeof params.newChat === 'string' && params.newChat.trim().length > 0;
    if (shouldStartNewChat) {
      setAuthConversationId(null);
      setGuestConversationId(null);
      setInput('');
      inputValueRef.current = '';
      setAttachedAssets([]);
      setMessages([createWelcomeMessage()]);
      return;
    }
    if (!targetConversationId) return;

    const hydrateTarget = async () => {
      try {
        if (isAuthenticated) {
          const detail = await getAuthenticatedConversation(targetConversationId, { force: true });
          setAuthConversationId(targetConversationId);
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
  }, [createWelcomeMessage, isAuthenticated, mapAuthMessageToUiMessage, params.conversationId, params.newChat]);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
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
      }
    };
    setMessages([createWelcomeMessage()]);
    void loadGuestState();
  }, [createWelcomeMessage, isAuthenticated]);

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

    const showSub = Keyboard.addListener('keyboardWillShow', () => setIsIosKeyboardVisible(true));
    const changeSub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      setIsIosKeyboardVisible((event.endCoordinates.height ?? 0) > 0);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setIsIosKeyboardVisible(false));

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, []);

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

  return (
    <AppScreen title={t('app.name')} showHeading={false} contentTopOffset={-12}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        enabled={Platform.OS === 'ios'}
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

            {isAuthenticated ? (
              <View className="mb-2 flex-row items-center justify-end">
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
              </View>
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

            {!hasStartedChat ? (
              <View className="mb-2">
                <FlatList
                  data={quickPrompts}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Animated.View entering={FadeIn.duration(MOTION.duration.slow)}>
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        inputValueRef.current = item;
                        setInput(item);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.quickPrompt.insert', { prompt: item })}
                      accessibilityHint={t('chat.quickPrompt.hint')}
                      className="rounded-full border px-3 py-1.5"
                      style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF' }}
                    >
                      <Text numberOfLines={1} style={{ maxWidth: 300, color: colors.textSecondary, fontSize: 12 }}>
                        {item}
                      </Text>
                    </Pressable>
                    </Animated.View>
                  )}
                />
              </View>
            ) : null}

            <FlashList
              ref={messagesListRef}
              className="flex-1"
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
                const isImageGenerating = !isUser && item.isImageGenerating && !item.imageUrl;
                const isVideoGenerating = !isUser && item.isVideoGenerating && !item.videoUrl;
                const isImageMessage = !isUser && Boolean(item.imageUrl);
                const isVideoMessage = !isUser && Boolean(item.videoUrl);
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
                          <ExpoImage
                            source={{ uri: item.imageUrl! }}
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

                      {!isImageGenerating && !isVideoGenerating && !isImageMessage && !isVideoMessage ? (
                        <View
                          className="rounded-2xl px-3 py-2"
                          style={{
                            backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                          }}
                        >
                          <Text style={{ color: isUser ? '#FFFFFF' : colors.textPrimary, lineHeight: 20 }}>
                            {item.content || (isSending && !isUser ? streamingDots : '')}
                          </Text>
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
          layout={LinearTransition.springify().damping(24).stiffness(300).mass(0.72)}
          className="relative mt-3 rounded-[28px] border p-2"
          style={{
            borderColor: colors.primary,
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            marginBottom: composerBottomInset + (Platform.OS === 'ios' && isIosKeyboardVisible ? IOS_COMPOSER_KEYBOARD_GAP : 0),
          }}
        >
          <TextInput
            ref={composerInputRef}
            value={input}
            onChangeText={(text) => {
              inputValueRef.current = text;
              setInput(text);
            }}
            placeholder={t('chat.input.placeholder')}
            placeholderTextColor={colors.textSecondary}
            editable
            multiline
            maxLength={3000}
            onContentSizeChange={(event) => {
              const nextHeight = Math.min(128, Math.max(34, Math.ceil(event.nativeEvent.contentSize.height)));
              setComposerHeight(nextHeight);
            }}
            accessibilityLabel={t('chat.input.accessibility')}
            className="px-1.5 py-1"
            style={{
              color: colors.textPrimary,
              fontSize: input.trim().length ? 13 : 12,
              height: composerHeight,
              maxHeight: 128,
              paddingRight: isAuthenticated ? 8 : 46,
            }}
          />

          {isAuthenticated && attachedAssets.length ? (
            <View className="mb-1 mt-1 flex-row flex-wrap gap-1.5 px-1">
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

          {isAuthenticated ? (
            <View className="mt-1 flex-row items-center justify-between px-0.5 pb-0.5">
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
                      <Pressable onPress={pickDocumentAttachment} className="flex-row items-center rounded-md px-2 py-2">
                        <Ionicons name="document-text-outline" size={14} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>{t('chat.attachDocument')}</Text>
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => applyRandomPrompt('image')}
                  onLongPress={(event) => showTooltip(t('chat.tooltip.imageTemplate'), event)}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.imageShortcut')}
                  accessibilityHint={t('chat.imageShortcutHint')}
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{ borderColor: colors.border }}
                >
                  <Ionicons name="images-outline" size={13} color={colors.textPrimary} />
                </Pressable>

                <Pressable
                  onPress={() => applyRandomPrompt('video')}
                  onLongPress={(event) => showTooltip(t('chat.tooltip.videoTemplate'), event)}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.videoShortcut')}
                  accessibilityHint={t('chat.videoShortcutHint')}
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{ borderColor: colors.border }}
                >
                  <Ionicons name="videocam-outline" size={13} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSend}
                onLongPress={(event) => showTooltip(t('chat.send'), event)}
                disabled={!input.trim() || isSending}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                accessibilityHint={t('chat.sendHint')}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: !input.trim() || isSending ? '#A78BFA' : colors.primary,
                }}
              >
                <Ionicons name="send" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleSend}
              onLongPress={(event) => showTooltip(t('chat.send'), event)}
              disabled={!input.trim() || isSending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              accessibilityHint={t('chat.sendHint')}
              className="absolute bottom-2 right-2 h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: !input.trim() || isSending ? '#A78BFA' : colors.primary,
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
