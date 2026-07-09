import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  findNodeHandle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks';
import { MOTION, hapticImpact, hapticSelection } from '@/utils';

type PromptSuggestionsModalProps = {
  visible: boolean;
  suggestions: string[];
  loading?: boolean;
  title?: string;
  onClose: () => void;
  onSelectSuggestion: (suggestion: string) => void;
};

const PREVIEW_LENGTH = 180;

function truncateSuggestion(text: string) {
  const normalized = text.trim();
  if (normalized.length <= PREVIEW_LENGTH) {
    return { preview: normalized, truncated: false };
  }

  const sliced = normalized.slice(0, PREVIEW_LENGTH);
  const safePreview = sliced.slice(0, Math.max(0, sliced.lastIndexOf(' '))).trim() || sliced.trim();
  return {
    preview: `${safePreview}\u2026`,
    truncated: true,
  };
}

type SuggestionCardProps = {
  index: number;
  suggestion: string;
  onSelect: (suggestion: string) => void;
};

const SuggestionCard = memo(function SuggestionCard({
  index,
  suggestion,
  onSelect,
}: SuggestionCardProps) {
  const { colors, isDark } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const truncatedContent = useMemo(() => truncateSuggestion(suggestion), [suggestion]);

  useEffect(() => {
    setExpanded(false);
  }, [suggestion]);

  const visibleText = expanded || !truncatedContent.truncated ? suggestion : truncatedContent.preview;
  const toggleLabel = expanded ? 'Show less' : 'Read more';

  return (
    <View
      accessible
      accessibilityLabel={`Suggestion ${index + 1}. ${suggestion}`}
      className="mb-3 rounded-3xl border p-4"
      style={{
        borderColor: colors.border,
        backgroundColor: isDark ? '#111318' : '#FFFFFF',
      }}
    >
      <Text
        selectable
        style={{
          color: colors.textPrimary,
          fontSize: 15,
          lineHeight: 22,
        }}
      >
        {visibleText}
      </Text>

      <View className="mt-3 flex-row items-center justify-between gap-3">
        {truncatedContent.truncated ? (
          <Pressable
            onPress={() => {
              hapticSelection();
              setExpanded((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${toggleLabel} for suggestion ${index + 1}`}
            accessibilityHint={expanded ? 'Collapses the full suggestion text.' : 'Expands the full suggestion text.'}
            accessibilityState={{ expanded }}
            hitSlop={8}
            className="rounded-full px-1 py-1"
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{toggleLabel}</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          onPress={() => {
            hapticImpact();
            onSelect(suggestion);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use suggestion ${index + 1}`}
          accessibilityHint="Fills the message input with this suggestion."
          className="rounded-full px-4 py-2"
          style={{
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Use prompt</Text>
        </Pressable>
      </View>
    </View>
  );
});

export function PromptSuggestionsModal({
  visible,
  suggestions,
  loading = false,
  title = 'Prompt suggestions',
  onClose,
  onSelectSuggestion,
}: PromptSuggestionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const closeButtonRef = useRef<View | null>(null);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      const node = closeButtonRef.current ? findNodeHandle(closeButtonRef.current) : null;
      if (node) {
        AccessibilityInfo.setAccessibilityFocus?.(node);
      }
      AccessibilityInfo.announceForAccessibility?.(
        loading
          ? `${title}. Loading suggestions.`
          : suggestions.length
            ? `${title}. ${suggestions.length} suggestions available.`
            : `${title}. No suggestions available yet.`,
      );
    }, MOTION.duration.quick);

    return () => clearTimeout(timer);
  }, [loading, suggestions.length, title, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ backgroundColor: isDark ? '#090B10' : '#F5F7FB' }}
      >
        <View
          accessibilityViewIsModal
          className="flex-1"
          style={{
            paddingTop: insets.top + 10,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="mb-3 flex-row items-center justify-between px-5">
            <View className="mr-4 flex-1">
              <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>{title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                Tap any suggestion to fill the chat input.
              </Text>
            </View>

            <Pressable
              ref={closeButtonRef}
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close prompt suggestions"
              accessibilityHint="Returns to the chat composer."
              className="h-11 w-11 items-center justify-center rounded-full border"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#12151D' : '#FFFFFF',
              }}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="bulb-outline" size={28} color={colors.primary} />
              <Text
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 14 }}
              >
                Finding suggestions
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}
              >
                We are gathering prompt ideas based on what you have typed.
              </Text>
            </View>
          ) : suggestions.length ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${index}-${item}`}
              renderItem={({ item, index }) => (
                <SuggestionCard index={index} suggestion={item} onSelect={onSelectSuggestion} />
              )}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 14 }}>
                No suggestions yet
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}
              >
                Keep typing a little more and suggested prompts will appear here.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
