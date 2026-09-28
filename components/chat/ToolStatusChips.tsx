import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/hooks';
import { getToolCaption } from './toolCaptions';
import type { UiMessageToolCall } from './types';

/**
 * Live tool-call status chips for a native tool-calling turn. Ports web's
 * ToolStatusChips.tsx concept (not code) to React Native — same running/
 * success/failure states driven by the same tool_start/tool_end SSE events,
 * adapted to RN's ActivityIndicator (no CSS spin) and light/dark colors.
 * Captions come from toolCaptions.ts rather than the backend's raw label.
 */
type ToolChipProps = UiMessageToolCall & { isDark: boolean };

const ToolChip = ({ tool, label, ok, running, isDark }: ToolChipProps) => {
  const { t } = useI18n();
  const palette = running
    ? {
        border: isDark ? '#0C4A6E' : '#7DD3FC',
        background: isDark ? '#082F49' : '#F0F9FF',
        text: isDark ? '#7DD3FC' : '#0369A1',
      }
    : ok
      ? {
          border: isDark ? '#064E3B' : '#6EE7B7',
          background: isDark ? '#022C22' : '#ECFDF5',
          text: isDark ? '#6EE7B7' : '#047857',
        }
      : {
          border: isDark ? '#4C0519' : '#FDA4AF',
          background: isDark ? '#2C0A16' : '#FFF1F2',
          text: isDark ? '#FDA4AF' : '#BE123C',
        };
  const caption = getToolCaption(t, tool, label, running ? 'running' : ok ? 'done' : 'failed');

  return (
    <View
      className="mb-1 mt-1 max-w-full flex-row items-center self-start rounded-full border px-3 py-1"
      style={{ borderColor: palette.border, backgroundColor: palette.background }}
      accessibilityRole="text"
      accessibilityLabel={caption}
    >
      {running ? (
        <ActivityIndicator size="small" color={palette.text} style={{ marginRight: 6 }} />
      ) : (
        <Ionicons
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={14}
          color={palette.text}
          style={{ marginRight: 5 }}
        />
      )}
      <Text numberOfLines={1} style={{ flexShrink: 1, color: palette.text, fontSize: 12, fontWeight: '600' }}>
        {caption}
      </Text>
    </View>
  );
};

export function ToolStatusChips({ tools, isDark }: { tools: UiMessageToolCall[]; isDark: boolean }) {
  if (!tools.length) return null;
  return (
    <View className="mb-1 items-start">
      {tools.map((tool, index) => (
        <ToolChip key={`${tool.tool}-${index}`} {...tool} isDark={isDark} />
      ))}
    </View>
  );
}

export default ToolStatusChips;
