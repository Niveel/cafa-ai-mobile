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
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppScreen } from '@/components';
import { useAppContext } from '@/context';
import { createGuestConversation, ensureGuestSession, getGuestConversation, listGuestConversations, sendGuestMessageStream } from '@/features';
import { useAppTheme } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { MOTION, hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

type AttachedAsset = {
  id: string;
  label: string;
};

const IMAGE_MODE_PROMPTS = [
  'Generate image of a futuristic government operations center.',
  'Generate image of an underwater research city with glowing coral.',
  'Generate image of a cinematic aerial view of a neon megacity.',
  'Generate image of a modern courtroom with holographic evidence displays.',
];

const VIDEO_MODE_PROMPTS = [
  'Generate video of drones coordinating disaster relief over a coastal city.',
  'Generate video of a smart city skyline transitioning from sunset to neon night.',
  'Generate video of a national emergency war room during a cyber incident.',
  'Generate video of a futuristic parliament session with transparent voting screens.',
];

const QUICK_PROMPTS = [
  'Draft a strategic memo for national AI adoption in education.',
  'Summarize top risks in government chatbot deployment.',
  'Generate image of a modern smart city command center at sunset.',
];

const CHAT_MODEL_OPTIONS = [
  { key: 'ultra', label: 'Cafa Ultra', description: 'Best quality (uses more compute)' },
  { key: 'smart', label: 'Cafa Smart', description: 'Balanced quality' },
  { key: 'swift', label: 'Cafa Swift', description: 'Light tasks and fast' },
] as const;

function getPromptTitle(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return 'New guest chat';
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

function createIdempotencyKey(conversationId: string) {
  return `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMediaGenerationPrompt(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes('generate image') || normalized.includes('generate video');
}

const GUEST_TTS_RATE = Platform.select({
  ios: 0.46,
  android: 0.78,
  default: 0.78,
});

function WaveBar({ color, delay }: { color: string; delay: number }) {
  const scale = useSharedValue(0.45);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.45, { duration: 340, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 22,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.9,
        },
        animatedStyle,
      ]}
    />
  );
}

function RecordingWaves({ color }: { color: string }) {
  return (
    <View className="h-7 flex-row items-center gap-1.5">
      <WaveBar color={color} delay={0} />
      <WaveBar color={color} delay={90} />
      <WaveBar color={color} delay={180} />
      <WaveBar color={color} delay={270} />
      <WaveBar color={color} delay={360} />
    </View>
  );
}

export default function ChatScreen() {
  const ANDROID_KEYBOARD_CALIBRATION = 4;
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedAssets, setAttachedAssets] = useState<AttachedAsset[]>([]);
  const [tooltipState, setTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeModel, setActiveModel] = useState<'ultra' | 'smart' | 'swift'>('smart');
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: 'Hi, I am Cafa AI. Ask me anything or start with a task.',
      createdAt: Date.now(),
    },
  ]);
  const [composerHeight, setComposerHeight] = useState(34);
  const [androidComposerOffset, setAndroidComposerOffset] = useState(0);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [streamingDots, setStreamingDots] = useState('.');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesListRef = useRef<FlatList<UiMessage>>(null);
  const autoScrollEnabledRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDraftRef = useRef('');
  const isRecordingRef = useRef(false);
  const assistantFirstDeltaRef = useRef(false);
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
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, content: `${message.content}${event.content}` } : message,
                  ),
                );
              }
              if (event.type === 'done') {
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

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: 'Authenticated streaming will be connected after login flow wiring.' }
              : message,
          ),
        );
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

  const toggleReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: prev[messageId] === reaction ? undefined : reaction,
    }));
    hapticSelection();
  };

  const copyMessage = async (content: string) => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(content);
    showTransientNotice('Copied response.');
    hapticSuccess();
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
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
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
        // keep optimistic local starter state
      }
    };
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
    <AppScreen title="Cafa AI">
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        enabled={Platform.OS === 'ios'}
      >
          <View className="flex-1">
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
              <View className="relative">
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
                    style={{ borderColor: colors.border, backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF' }}
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
                        <View className="mt-1 flex-row items-center gap-1">
                          <Pressable
                            onPress={() => {
                              void copyMessage(item.content);
                            }}
                            onLongPress={(event) => showTooltip('Copy response', event)}
                            accessibilityRole="button"
                            accessibilityLabel="Copy response"
                            accessibilityHint="Copies this response to clipboard."
                            className="h-7 w-7 items-center justify-center rounded-full border"
                            style={{ borderColor: colors.border }}
                          >
                            <Ionicons name="copy-outline" size={13} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => toggleReaction(item.id, 'like')}
                            onLongPress={(event) => showTooltip('Like response', event)}
                            accessibilityRole="button"
                            accessibilityLabel="Like response"
                            accessibilityHint="Marks this response as helpful."
                            accessibilityState={{ selected: reaction === 'like' }}
                            className="h-7 w-7 items-center justify-center rounded-full border"
                            style={{ borderColor: reaction === 'like' ? colors.primary : colors.border }}
                          >
                            <Ionicons
                              name={reaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                              size={13}
                              color={reaction === 'like' ? colors.primary : colors.textSecondary}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => toggleReaction(item.id, 'dislike')}
                            onLongPress={(event) => showTooltip('Dislike response', event)}
                            accessibilityRole="button"
                            accessibilityLabel="Dislike response"
                            accessibilityHint="Marks this response as unhelpful."
                            accessibilityState={{ selected: reaction === 'dislike' }}
                            className="h-7 w-7 items-center justify-center rounded-full border"
                            style={{ borderColor: reaction === 'dislike' ? colors.primary : colors.border }}
                          >
                            <Ionicons
                              name={reaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                              size={13}
                              color={reaction === 'dislike' ? colors.primary : colors.textSecondary}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              void shareMessage(item.content);
                            }}
                            onLongPress={(event) => showTooltip('Share response', event)}
                            accessibilityRole="button"
                            accessibilityLabel="Share response"
                            accessibilityHint="Opens the share sheet for this response."
                            className="h-7 w-7 items-center justify-center rounded-full border"
                            style={{ borderColor: colors.border }}
                          >
                            <Ionicons name="share-social-outline" size={13} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => toggleReadAloud(item.id, item.content)}
                            onLongPress={(event) => showTooltip('Read response aloud', event)}
                            accessibilityRole="button"
                            accessibilityLabel={isReading ? 'Stop reading response aloud' : 'Read response aloud'}
                            accessibilityHint="Uses device speech to read this response."
                            accessibilityState={{ selected: isReading }}
                            className="h-7 w-7 items-center justify-center rounded-full border"
                            style={{ borderColor: isReading ? colors.primary : colors.border }}
                          >
                            <Ionicons
                              name={isReading ? 'stop-circle-outline' : 'volume-high-outline'}
                              size={13}
                              color={isReading ? colors.primary : colors.textSecondary}
                            />
                          </Pressable>
                        </View>
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

                <View>
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
                      style={{ borderColor: colors.border, backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF' }}
                    >
                      <Pressable onPress={pickAttachment} className="flex-row items-center rounded-md px-2 py-2">
                        <Ionicons name="image-outline" size={14} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>Image attachment</Text>
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

