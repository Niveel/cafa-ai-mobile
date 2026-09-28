import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppContext } from '@/context';

type SandboxBuildNoticeProps = {
  isDark: boolean;
};

// Shown for the SSE `sandbox_session` event: a tool (e.g. generate_website) started a live build
// the client could stream via GET /chat/:id/sandbox/:sessionId/events (API_INTEGRATION_GUIDE.md
// §2). Backend confirmed 2026-09-24 that mobile chat can trigger it. There is no in-app viewer
// for that stream yet -- building one is a real, separate feature -- so this just tells the user
// a build is happening instead of the event being silently dropped.
export function SandboxBuildNotice({ isDark }: SandboxBuildNoticeProps) {
  const { colors, t } = useAppContext();

  return (
    <View
      className="mt-2 self-stretch flex-row items-center rounded-2xl border px-3 py-2.5"
      style={{ borderColor: colors.border, backgroundColor: isDark ? '#0D0D0D' : '#FAFAFA' }}
    >
      <Ionicons name="construct-outline" size={16} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginLeft: 8, flex: 1 }}>
        {t('chat.sandbox.notice')}
      </Text>
    </View>
  );
}
