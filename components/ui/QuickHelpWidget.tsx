import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StreamingMarkdown } from '@/components/chat/StreamingMarkdown';
import { sendQuickHelpMessage, type QuickHelpMessage } from '@/features/support';

/**
 * Real, RN port of web's QuickHelpWidget.tsx -- a small, public, no-login
 * quick-help chatbot (POST /support/quick-help, no auth required). Meant
 * for surfaces a visitor may reach before signing in (login/signup),
 * mirroring web's real placement outside the main authenticated chat.
 * A floating action button that expands into a small chat panel, RN has
 * no fixed-position CSS so this uses an absolutely-positioned View instead.
 */
export function QuickHelpWidget({ isDark }: { isDark: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<QuickHelpMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput('');
    setErrorMessage('');
    const nextMessages: QuickHelpMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const reply = await sendQuickHelpMessage(text, nextMessages.slice(0, -1));
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not get an answer right now.');
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const bg = isDark ? '#0B0B0F' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#F5F5F5' : '#111111';
  const mutedText = isDark ? '#A3A3A3' : 'rgba(0,0,0,0.55)';

  return (
    <View style={{ position: 'absolute', bottom: 24, right: 20 }}>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Quick help"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#7C3AED',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="help-buoy-outline" size={26} color="#FFFFFF" />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ height: '70%', backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="help-buoy-outline" size={18} color="#7C3AED" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>Quick help</Text>
              </View>
              <Pressable onPress={() => setIsOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={textColor} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <Text style={{ fontSize: 13, color: mutedText }}>
                  Ask a quick question about Cafa AI -- plans, credits, features, or how something works.
                </Text>
              ) : null}
              {messages.map((message, index) => (
                <View
                  key={index}
                  style={{
                    maxWidth: '85%',
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: message.role === 'user' ? '#7C3AED' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                  }}
                >
                  {message.role === 'assistant' ? (
                    <StreamingMarkdown
                      content={message.content}
                      isUser={false}
                      onOpenLink={(url) => { void Linking.openURL(url); }}
                    />
                  ) : (
                    <Text style={{ fontSize: 14, color: '#FFFFFF' }}>{message.content}</Text>
                  )}
                </View>
              ))}
              {isSending ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  }}
                >
                  <ActivityIndicator size="small" color={textColor} />
                  <Text style={{ fontSize: 13, color: mutedText }}>Thinking...</Text>
                </View>
              ) : null}
              {errorMessage ? <Text style={{ fontSize: 13, color: '#EF4444' }}>{errorMessage}</Text> : null}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: border,
                padding: 12,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask a question..."
                placeholderTextColor={mutedText}
                editable={!isSending}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 12,
                  color: textColor,
                  fontSize: 14,
                }}
                onSubmitEditing={() => void sendMessage()}
              />
              <Pressable
                onPress={() => void sendMessage()}
                disabled={!input.trim() || isSending}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#7C3AED',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !input.trim() || isSending ? 0.5 : 1,
                }}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default QuickHelpWidget;
