import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AppScreen } from '@/components';
import { useAppContext } from '@/context';
import { useAppTheme } from '@/hooks';

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

export default function ChatScreen() {
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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    setInput('');
    setIsSending(true);
    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Got it. Here is a strong next step for "${trimmed}".`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
    }, 700);
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

    setVoiceStatus('Recording voice… tap again to stop.');
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

  return (
    <AppScreen title="Cafa AI" subtitle="Mobile AI assistant built for fast, high-quality conversations.">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {!isAuthenticated ? (
          <View className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Guest mode: login to use the full app experience.
            </Text>
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
                {activeModel === 'ultra' ? 'Cafa Ultra' : activeModel === 'smart' ? 'Cafa Smart' : 'Cafa Swift'}
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
                className="absolute right-0 top-9 z-40 min-w-[170px] rounded-xl border p-1"
                style={{ borderColor: colors.border, backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF' }}
              >
                {[
                  { key: 'ultra', label: 'Cafa Ultra' },
                  { key: 'smart', label: 'Cafa Smart' },
                  { key: 'swift', label: 'Cafa Swift' },
                ].map((model) => {
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
                    >
                      <Text style={{ color: active ? colors.primary : colors.textPrimary, fontSize: 12 }}>
                        {model.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <FlatList
          className="flex-1"
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 6 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
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
                  <Text style={{ color: isUser ? '#FFFFFF' : colors.textPrimary, lineHeight: 20 }}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />

        {isSending ? (
          <View className="pb-1">
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cafa AI is typing...</Text>
          </View>
        ) : null}

        <View
          className="relative mt-3 rounded-[28px] border p-2"
          style={{ borderColor: colors.border, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything, or type: generate image/video of ..."
            placeholderTextColor={colors.textSecondary}
            editable
            multiline
            maxLength={3000}
            accessibilityLabel="Message input"
            className="max-h-32 min-h-[34px] px-1.5 py-1"
            style={{ color: colors.textPrimary, fontSize: 13 }}
          />

          {attachedAssets.length ? (
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
                <Ionicons name={isRecording ? 'stop' : 'mic-outline'} size={14} color={isRecording ? '#FFFFFF' : colors.textPrimary} />
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
                {voiceStatus || 'Recording… tap stop when you are done.'}
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
