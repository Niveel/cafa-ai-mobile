import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  type GestureResponderEvent,
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
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  LinearTransition,
} from 'react-native-reanimated';

import {
  AppScreen,
  CHAT_MODEL_OPTIONS,
  GUEST_TTS_RATE,
  IMAGE_MODE_PROMPTS,
  MessageActionsRow,
  QUICK_PROMPTS,
  RecordingWaves,
  UserPromptActionsRow,
  VIDEO_MODE_PROMPTS,
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
  getAuthenticatedConversation,
  getGuestConversation,
  listAuthenticatedConversations,
  listGuestConversations,
  sendAuthenticatedMessageStream,
  sendGuestMessageStream,
  toggleAuthenticatedMessageReaction,
} from '@/features';
import { useAppTheme } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { MOTION, hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils';

export default function ChatScreen() {
  const createWelcomeMessage = (): UiMessage => ({
    id: 'welcome-1',
    role: 'assistant',
    content: 'Hi, I am Cafa AI. Ask me anything or start with a task.',
    createdAt: Date.now(),
  });
  const ANDROID_KEYBOARD_CALIBRATION = 4;
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated } = useAppContext();
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
  const [authConversationId, setAuthConversationId] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [streamingDots, setStreamingDots] = useState('.');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesListRef = useRef<FlatList<UiMessage>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const autoScrollEnabledRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuTouchRef = useRef(false);
  const speechDraftRef = useRef('');
  const isRecordingRef = useRef(false);
  const assistantFirstDeltaRef = useRef(false);
  const pendingDeltaRef = useRef('');
  const pendingAssistantIdRef = useRef<string | null>(null);
  const deltaFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedChat = messages.some((message) => message.role === 'user');
  const screenWidth = Dimensions.get('window').width;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  };

  const showTooltip = (text: string, event?: GestureResponderEvent) => {
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
      flushPendingAssistantDelta();
      deltaFlushTimerRef.current = null;
    }, 44);
  };

  const handleSend = () => {
    const run = async () => {
      const trimmed = input.trim();
      if (!trimmed || isSending) return;
      let lastEndpoint = `${API_BASE_URL}/chat`;

      const userMessage: UiMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

      const assistantId = `assistant-${Date.now()}`;

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
      Keyboard.dismiss();
      setInput('');
      setIsSending(true);
      setStatusNotice('');
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
                      content: 'Image and video generation are available after login. Please log in to use media tools.',
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
            const created = await createGuestConversation(getPromptTitle(trimmed));
            conversationId = created.conversationId;
            setGuestConversationId(conversationId);
          }

          lastEndpoint = `${API_BASE_URL}/guest/chat/${conversationId}/messages`;
          await sendGuestMessageStream(
            conversationId,
            trimmed,
            (event) => {
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
              }
              if (event.type === 'error') {
                throw new Error(event.message || 'Guest chat stream failed.');
              }
            },
            createIdempotencyKey(conversationId),
          );
          return;
        }

        let conversationId = authConversationId;
        if (!conversationId) {
          lastEndpoint = `${API_BASE_URL}/chat`;
          const created = await createAuthenticatedConversation(getPromptTitle(trimmed));
          conversationId = created.conversationId;
          setAuthConversationId(conversationId);
        }

        lastEndpoint = `${API_BASE_URL}/chat/${conversationId}/messages`;
        await sendAuthenticatedMessageStream(conversationId, trimmed, (event) => {
          if (event.type === 'delta') {
            if (!assistantFirstDeltaRef.current) {
              assistantFirstDeltaRef.current = true;
              hapticSelection();
            }
            queueAssistantDelta(assistantId, event.content);
            return;
          }

          if (event.type === 'meta' && event.messageId) {
            setMessages((prev) =>
              prev.map((message) => (message.id === assistantId ? { ...message, id: event.messageId! } : message)),
            );
            return;
          }

          if (event.type === 'done') {
            flushPendingAssistantDelta();
            hapticSuccess();
            if (event.messageId) {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId ? { ...message, id: event.messageId!, tokens: event.tokens } : message,
                ),
              );
            }
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not send your message right now.';
        console.log(`[chat-send:error] endpoint=${lastEndpoint} message="${message}"`);
        hapticError();

        setStatusNotice(message);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content: message.includes('GUEST_DAILY_LIMIT_EXCEEDED')
                    ? 'Guest message limit reached for now. Please try again after reset.'
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
        setIsSending(false);
      }
    };

    void run();
  };

  const applyRandomPrompt = (kind: 'image' | 'video') => {
    const pool = kind === 'image' ? IMAGE_MODE_PROMPTS : VIDEO_MODE_PROMPTS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
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
      showTransientNotice('Microphone and speech permissions are required.');
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
    setAttachedAssets((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: asset.fileName ?? 'image-attachment.jpg',
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
      },
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  };

  const showTransientNotice = (message: string) => {
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, 2200);
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
      showTransientNotice('Could not save reaction right now.');
    }
  };

  const copyMessage = async (content: string) => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(content);
    showTransientNotice('Copied text.');
    hapticSuccess();
  };

  const editPrompt = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
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
      showTransientNotice('Could not open share sheet.');
    }
  };

  const toggleReadAloud = (messageId: string, content: string) => {
    if (!content.trim()) return;

    if (readingMessageId === messageId) {
      hapticSelection();
      Speech.stop();
      setReadingMessageId(null);
      return;
    }

    hapticSelection();
    Speech.stop();
    setReadingMessageId(messageId);
    Speech.speak(content, {
      rate: GUEST_TTS_RATE,
      pitch: 1,
      onDone: () => setReadingMessageId(null),
      onStopped: () => setReadingMessageId(null),
      onError: () => {
        setReadingMessageId(null);
        showTransientNotice('Could not read this response aloud.');
      },
    });
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
    setInput((prev) => `${prev}${prev ? '\n' : ''}${transcript}`);
    hapticSuccess();
  });

  useSpeechRecognitionEvent('error', () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    hapticError();
    showTransientNotice('Speech recognition failed. Please try again.');
  });

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (deltaFlushTimerRef.current) clearTimeout(deltaFlushTimerRef.current);
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    };
  }, []);

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
          detail.messages.map((message) => ({
            id: message.id,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
            createdAt: new Date(message.createdAt).getTime(),
            tokens: message.tokens,
          })),
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
        const message = error instanceof Error ? error.message : 'Could not load your conversations.';
        showTransientNotice(message);
        setMessages([createWelcomeMessage()]);
      } finally {
        setIsHydratingAuthChat(false);
      }
    };

    setIsHydratingAuthChat(true);
    void loadAuthenticatedState();
  }, [isAuthenticated]);

  useEffect(() => {
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const shouldStartNewChat = params.newChat === '1';
    if (shouldStartNewChat) {
      setAuthConversationId(null);
      setGuestConversationId(null);
      setMessages([createWelcomeMessage()]);
      return;
    }
    if (!targetConversationId) return;

    const hydrateTarget = async () => {
      try {
        if (isAuthenticated) {
          const detail = await getAuthenticatedConversation(targetConversationId);
          setAuthConversationId(targetConversationId);
          setMessages(
            detail.messages.map((message) => ({
              id: message.id,
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: message.content,
              createdAt: new Date(message.createdAt).getTime(),
              tokens: message.tokens,
            })),
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

        const detail = await getGuestConversation(targetConversationId);
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
  }, [isAuthenticated, params.conversationId, params.newChat]);

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
  }, [isAuthenticated]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const syncOffset = (screenY?: number, fallbackHeight?: number) => {
      const windowHeight = Dimensions.get('window').height;
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, windowHeight - screenY);
        setAndroidComposerOffset(Math.max(0, overlap - ANDROID_KEYBOARD_CALIBRATION));
        return;
      }
      setAndroidComposerOffset(Math.max(0, (fallbackHeight ?? 0) - ANDROID_KEYBOARD_CALIBRATION));
    };

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setAndroidComposerOffset(0));

    return () => {
      showSub.remove();
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
    <AppScreen title="Cafa AI" showHeading={false}>
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
                  Guest mode: login to use the full app experience.
                </Text>
              </Animated.View>
            ) : null}
            {!!statusNotice ? (
              <Animated.View entering={FadeInDown.duration(MOTION.duration.normal)} className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{statusNotice}</Text>
              </Animated.View>
            ) : null}

            <View className="mb-2 flex-row items-center justify-end">
              <View
                className="relative"
                style={{
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
                  accessibilityLabel="Select chat model"
                  className="h-8 flex-row items-center rounded-full border px-3"
                  style={{ borderColor: colors.border, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                    {CHAT_MODEL_OPTIONS.find((model) => model.key === activeModel)?.label ?? 'Cafa Smart'}
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
                      borderColor: colors.border,
                      backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF',
                    }}
                    onTouchStart={() => {
                      menuTouchRef.current = true;
                    }}
                  >
                    {CHAT_MODEL_OPTIONS.map((model) => {
                      const active = activeModel === model.key;
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
                          accessibilityLabel={`${model.label} model`}
                          accessibilityHint={model.description}
                        >
                          <Text style={{ color: active ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                            {model.label}
                          </Text>
                          <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                            {model.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </Animated.View>
                ) : null}
              </View>
            </View>

            {!hasStartedChat ? (
              <View className="mb-2">
                <FlatList
                  data={QUICK_PROMPTS}
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
                        setInput(item);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Insert prompt: ${item}`}
                      accessibilityHint="Adds this template prompt to the message input."
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

            <FlatList
              ref={messagesListRef}
              className="flex-1"
              ListEmptyComponent={
                isAuthenticated && isHydratingAuthChat ? (
                  <View className="px-2 py-2">
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Loading conversations...</Text>
                  </View>
                ) : null
              }
              data={messages}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 2,
                paddingVertical: 6,
                paddingBottom: Platform.OS === 'android' ? 36 : 30,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              removeClippedSubviews
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
                return (
                  <Animated.View entering={FadeInUp.duration(MOTION.duration.normal)} className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <View className="max-w-[88%]">
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

                      {!isUser && item.content.trim() ? (
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
                accessibilityLabel="Scroll to latest messages"
                accessibilityHint="Jumps to the newest message at the bottom of the chat."
                className="absolute right-3 h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  bottom: 96 + (Platform.OS === 'android' ? androidComposerOffset : 0),
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
            marginBottom: Platform.OS === 'android' ? androidComposerOffset : 0,
          }}
        >
          <TextInput
            ref={composerInputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything, or type: generate image/video..."
            placeholderTextColor={colors.textSecondary}
            editable
            multiline
            maxLength={3000}
            onContentSizeChange={(event) => {
              const nextHeight = Math.min(128, Math.max(34, Math.ceil(event.nativeEvent.contentSize.height)));
              setComposerHeight(nextHeight);
            }}
            accessibilityLabel="Message input"
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
                    accessibilityLabel="Remove attachment"
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
                  onLongPress={(event) => showTooltip(isRecording ? 'Stop recording' : 'Start recording', event)}
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? 'Stop voice recording' : 'Start voice recording'}
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
                    onLongPress={(event) => showTooltip('Attach file', event)}
                    accessibilityRole="button"
                    accessibilityLabel="Attach file"
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
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>Image attachment</Text>
                      </Pressable>
                      <Pressable onPress={pickDocumentAttachment} className="flex-row items-center rounded-md px-2 py-2">
                        <Ionicons name="document-text-outline" size={14} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>Document attachment</Text>
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => applyRandomPrompt('image')}
                  onLongPress={(event) => showTooltip('Image prompt template', event)}
                  accessibilityRole="button"
                  accessibilityLabel="Image generation shortcut"
                  accessibilityHint="Inserts a random image generation prompt into the message input."
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{ borderColor: colors.border }}
                >
                  <Ionicons name="images-outline" size={13} color={colors.textPrimary} />
                </Pressable>

                <Pressable
                  onPress={() => applyRandomPrompt('video')}
                  onLongPress={(event) => showTooltip('Video prompt template', event)}
                  accessibilityRole="button"
                  accessibilityLabel="Video generation shortcut"
                  accessibilityHint="Inserts a random video generation prompt into the message input."
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{ borderColor: colors.border }}
                >
                  <Ionicons name="videocam-outline" size={13} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSend}
                onLongPress={(event) => showTooltip('Send message', event)}
                disabled={!input.trim() || isSending}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityHint="Sends your current message."
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
              onLongPress={(event) => showTooltip('Send message', event)}
              disabled={!input.trim() || isSending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityHint="Sends your current message."
              className="absolute bottom-2 right-2 h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: !input.trim() || isSending ? '#A78BFA' : colors.primary,
              }}
            >
              <Ionicons name="send" size={15} color="#FFFFFF" />
            </Pressable>
          )}

          {tooltipState ? (
            <Animated.View
              entering={FadeIn.duration(MOTION.duration.quick)}
              pointerEvents="none"
              className="absolute rounded-md px-2 py-1"
              style={{
                backgroundColor: isDark ? '#171717' : '#111111',
                left: Math.max(8, Math.min(tooltipState.x - 56, screenWidth - 124)),
                top: Math.max(8, tooltipState.y - 40),
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11 }}>{tooltipState.text}</Text>
            </Animated.View>
          ) : null}

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
          </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

