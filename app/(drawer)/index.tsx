import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AppScreen } from '@/components';
import { useAppContext } from '@/context';
import { createGuestConversation, ensureGuestSession, getGuestConversation, listGuestConversations, sendGuestMessageStream } from '@/features';
import { useAppTheme } from '@/hooks';
import { API_BASE_URL } from '@/lib';

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

export default function ChatScreen() {
  const ANDROID_KEYBOARD_CALIBRATION = 4;
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedAssets, setAttachedAssets] = useState<AttachedAsset[]>([]);
  const [tooltipText, setTooltipText] = useState('');
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
  const [streamingDots, setStreamingDots] = useState('.');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesListRef = useRef<FlatList<UiMessage>>(null);
  const autoScrollEnabledRef = useRef(true);
  const hasStartedChat = messages.some((message) => message.role === 'user');

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
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
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, content: `${message.content}${event.content}` } : message,
                  ),
                );
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

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceStatus('Voice note captured. Review before sending.');
      setInput((prev) => `${prev}${prev ? '\n' : ''}[Voice note transcript placeholder]`);
      return;
    }

    setVoiceStatus('Recording voice... tap again to stop.');
    setIsRecording(true);
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
    setVoiceStatus('Attachment added.');
  };

  const removeAttachment = (id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    if (!tooltipText) return;
    const timeout = setTimeout(() => setTooltipText(''), 1200);
    return () => clearTimeout(timeout);
  }, [tooltipText]);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setVoiceStatus('');
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View className="flex-1">
            {!isAuthenticated ? (
              <View className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Guest mode: login to use the full app experience.
                </Text>
              </View>
            ) : null}
            {!!statusNotice ? (
              <View className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{statusNotice}</Text>
              </View>
            ) : null}

            <View className="mb-2 flex-row items-center justify-end">
              <View className="relative">
                <Pressable
                  onPress={() => setModelMenuOpen((prev) => !prev)}
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
                  <View
                    className="absolute right-0 top-9 z-40 min-w-[240px] rounded-xl border p-1"
                    style={{ borderColor: colors.border, backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF' }}
                  >
                    {CHAT_MODEL_OPTIONS.map((model) => {
                      const active = activeModel === model.key;
                      return (
                        <Pressable
                          key={model.key}
                          onPress={() => {
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
                  </View>
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
                    <Pressable
                      onPress={() => setInput(item)}
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
                  )}
                />
              </View>
            ) : null}

            <FlatList
              ref={messagesListRef}
              className="flex-1"
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 2,
                paddingVertical: 6,
                paddingBottom: Platform.OS === 'android' ? 10 : 6,
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
                setShowScrollToBottom(!isNearBottom);
              }}
              renderItem={({ item }) => {
                const isUser = item.role === 'user';
                return (
                  <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <View
                      className="max-w-[88%] rounded-2xl px-3 py-2"
                      style={{
                        backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                      }}
                    >
                      <Text style={{ color: isUser ? '#FFFFFF' : colors.textPrimary, lineHeight: 20 }}>
                        {item.content || (isSending && !isUser ? streamingDots : '')}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {showScrollToBottom ? (
              <Pressable
                onPress={() => {
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
            ) : null}

            <View
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
                  onLongPress={() => setTooltipText(isRecording ? 'Stop recording' : 'Start recording')}
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
                    onPress={() => setAttachmentMenuOpen((prev) => !prev)}
                    onLongPress={() => setTooltipText('Attach file')}
                    accessibilityRole="button"
                    accessibilityLabel="Attach file"
                    className="h-8 w-8 items-center justify-center rounded-full border"
                    style={{ borderColor: colors.border }}
                  >
                    <Ionicons name="attach-outline" size={14} color={colors.textPrimary} />
                  </Pressable>

                  {attachmentMenuOpen ? (
                    <View
                      className="absolute bottom-9 left-0 z-30 min-w-[190px] rounded-lg border p-1"
                      style={{ borderColor: colors.border, backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF' }}
                    >
                      <Pressable onPress={pickAttachment} className="flex-row items-center rounded-md px-2 py-2">
                        <Ionicons name="image-outline" size={14} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, marginLeft: 8 }}>Image attachment</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => applyRandomPrompt('image')}
                  onLongPress={() => setTooltipText('Image prompt template')}
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
                  onLongPress={() => setTooltipText('Video prompt template')}
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
                onLongPress={() => setTooltipText('Send message')}
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
              onLongPress={() => setTooltipText('Send message')}
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

          {tooltipText ? (
            <View
              pointerEvents="none"
              className="absolute bottom-14 right-2 rounded-md px-2 py-1"
              style={{ backgroundColor: isDark ? '#171717' : '#111111' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11 }}>{tooltipText}</Text>
            </View>
          ) : null}

          {isRecording || voiceStatus ? (
            <View className="mt-1 rounded-md border px-2 py-1.5" style={{ borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {voiceStatus || 'Recording... tap stop when you are done.'}
              </Text>
            </View>
          ) : null}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

