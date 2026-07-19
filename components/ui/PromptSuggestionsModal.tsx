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

import { useAppTheme, useI18n } from '@/hooks';
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
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const truncatedContent = useMemo(() => truncateSuggestion(suggestion), [suggestion]);

  useEffect(() => {
    setExpanded(false);
  }, [suggestion]);

  const visibleText = expanded || !truncatedContent.truncated ? suggestion : truncatedContent.preview;
  const toggleLabel = expanded ? t('promptSuggestions.showLess') : t('promptSuggestions.readMore');

  return (
    <View
      accessible
      accessibilityLabel={t('promptSuggestions.itemLabel', { number: String(index + 1), suggestion })}
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
            accessibilityLabel={t('promptSuggestions.toggleLabel', { action: toggleLabel, number: String(index + 1) })}
            accessibilityHint={t(expanded ? 'promptSuggestions.collapseHint' : 'promptSuggestions.expandHint')}
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
          accessibilityLabel={t('promptSuggestions.useLabel', { number: String(index + 1) })}
          accessibilityHint={t('promptSuggestions.useHint')}
          className="rounded-full px-4 py-2"
          style={{
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t('promptSuggestions.usePrompt')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

export function PromptSuggestionsModal({
  visible,
  suggestions,
  loading = false,
  title,
  onClose,
  onSelectSuggestion,
}: PromptSuggestionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const modalTitle = title ?? t('promptSuggestions.title');
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
          ? t('promptSuggestions.loadingA11y', { title: modalTitle })
          : suggestions.length
            ? t('promptSuggestions.countA11y', { title: modalTitle, count: String(suggestions.length) })
            : t('promptSuggestions.emptyA11y', { title: modalTitle }),
      );
    }, MOTION.duration.quick);

    return () => clearTimeout(timer);
  }, [loading, modalTitle, suggestions.length, t, visible]);

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
              <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>{modalTitle}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {t('promptSuggestions.subtitle')}
              </Text>
            </View>

            <Pressable
              ref={closeButtonRef}
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('promptSuggestions.close')}
              accessibilityHint={t('promptSuggestions.closeHint')}
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
                {t('promptSuggestions.finding')}
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}
              >
                {t('promptSuggestions.findingBody')}
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
                {t('promptSuggestions.empty')}
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}
              >
                {t('promptSuggestions.emptyBody')}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
