import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * Collapsible reasoning panel for a live tool-calling turn. Ports web's
 * ThinkingPanel.tsx concept (not code) to React Native: auto-opens while
 * reasoning is actively streaming (so live growth is visible by default)
 * but never fights a manual toggle once the user has touched it; a live
 * "Thinking for Xs..." duration while streaming; the raw trace is NEVER
 * shown by default at rest -- only the real, second-pass summary (or,
 * mid-stream, the current live step label) is, with an explicit "Show full
 * reasoning" opt-in.
 */
export type ThinkingPanelProps = {
  reasoning: string;
  reasoningSummary?: string;
  currentStep?: string;
  isStreaming: boolean;
  startedAt?: number;
  isDark: boolean;
};

export function ThinkingPanel({
  reasoning,
  reasoningSummary,
  currentStep,
  isStreaming,
  startedAt,
  isDark,
}: ThinkingPanelProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [userToggledReasoning, setUserToggledReasoning] = useState(false);
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  useEffect(() => {
    if (isStreaming && !userToggledReasoning) setShowReasoning(true);
  }, [isStreaming, userToggledReasoning]);

  const [thinkingSecs, setThinkingSecs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isStreaming || !startedAt) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setThinkingSecs(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming, startedAt]);

  if (!reasoning) return null;

  const mutedText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const bodyText = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const dimText = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const panelBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  return (
    <View className="mb-2">
      <Pressable
        onPress={() => {
          setUserToggledReasoning(true);
          setShowReasoning((s) => !s);
        }}
        className="flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={isStreaming ? `Thinking for ${thinkingSecs} seconds` : 'Thinking'}
      >
        {isStreaming ? (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#0EA5E9',
              marginRight: 6,
            }}
          />
        ) : null}
        <Text style={{ color: mutedText, fontSize: 11 }}>{showReasoning ? '▾' : '▸'} </Text>
        <Text style={{ color: mutedText, fontSize: 11, fontWeight: '600' }}>
          {isStreaming ? `Thinking for ${thinkingSecs}s...` : 'Thinking'}
        </Text>
      </Pressable>
      {showReasoning ? (
        <View
          className="mt-1 rounded-lg border p-3"
          style={{ borderColor: panelBorder, backgroundColor: panelBg }}
        >
          {isStreaming ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={bodyText} style={{ marginRight: 8 }} />
              <Text style={{ color: bodyText, fontSize: 12, flexShrink: 1 }}>
                {currentStep ?? 'Thinking...'}
              </Text>
            </View>
          ) : showFullReasoning ? (
            <>
              <Text style={{ color: dimText, fontSize: 12 }}>{reasoning}</Text>
              <Pressable onPress={() => setShowFullReasoning(false)}>
                <Text style={{ color: dimText, fontSize: 12, marginTop: 8, textDecorationLine: 'underline' }}>
                  Show summary
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: bodyText, fontSize: 12 }}>
                {reasoningSummary ?? 'Summarizing reasoning...'}
              </Text>
              <Pressable onPress={() => setShowFullReasoning(true)}>
                <Text style={{ color: dimText, fontSize: 12, marginTop: 8, textDecorationLine: 'underline' }}>
                  Show full reasoning
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default ThinkingPanel;
