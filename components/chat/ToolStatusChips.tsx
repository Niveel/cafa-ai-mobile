import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/hooks';
import { ShimmerText } from './ShimmerText';
import { getToolCaption } from './toolCaptions';
import type { UiMessageToolCall } from './types';

/**
 * Tool progress for a native tool-calling turn, styled like ChatGPT: while a
 * tool runs, one shimmering line names what is happening ("Searching the web").
 * Finished steps disappear so the answer stays the focus. A step that failed
 * or was cut off stays visible as a quiet line with a "Try again" action, so a
 * dropped connection never leaves a spinner running forever.
 */
type ToolStatusChipsProps = {
  tools: UiMessageToolCall[];
  isDark: boolean;
  onRetry?: () => void;
};

export function ToolStatusChips({ tools, isDark, onRetry }: ToolStatusChipsProps) {
  const { t } = useI18n();
  if (!tools.length) return null;

  const mutedColor = isDark ? '#9A9A9A' : '#6B6B6B';
  const running = [...tools].reverse().find((tool) => tool.running);
  const failed = tools.filter((tool) => !tool.running && tool.ok === false);

  if (running) {
    return (
      <View className="mb-1 mt-1 self-start" style={{ maxWidth: '100%' }}>
        <ShimmerText text={`${getToolCaption(t, running.tool, running.label, 'running')}…`} color={mutedColor} />
      </View>
    );
  }

  if (!failed.length) return null;

  const latest = failed[failed.length - 1];
  const caption = getToolCaption(t, latest.tool, latest.label, 'failed');
  return (
    <View className="mb-1 mt-1 self-start" style={{ maxWidth: '100%' }}>
      <View className="flex-row items-center" accessibilityRole="alert" accessibilityLabel={caption}>
        <Ionicons name="alert-circle-outline" size={16} color={mutedColor} style={{ marginRight: 6 }} />
        <Text style={{ flexShrink: 1, color: mutedColor, fontSize: 14, lineHeight: 20 }}>{caption}</Text>
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('chat.tool.retry')}
          hitSlop={8}
          className="mt-1 flex-row items-center self-start rounded-full border px-3 py-1"
          style={{ borderColor: isDark ? '#3A3A3A' : '#D4D4D4' }}
        >
          <Ionicons name="refresh" size={13} color={isDark ? '#E5E5E5' : '#262626'} />
          <Text style={{ marginLeft: 6, color: isDark ? '#E5E5E5' : '#262626', fontSize: 13, fontWeight: '600' }}>
            {t('chat.tool.retry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default ToolStatusChips;
