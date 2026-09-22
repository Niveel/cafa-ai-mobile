import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPushPermissionState, isPushSupported, registerForPushNotifications } from '../services/pushRegistration';

const DISMISSED_AT_KEY = 'cafa_push_nudge_dismissed_at';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days -- matches web's PushNudgeBanner.

/**
 * Real, RN port of web's PushNudgeBanner.tsx. Deliberately excluded from
 * image generation (web's own reasoning: images finish in ~3-4s, the
 * banner would just flash and vanish) -- only mount this beside
 * video/avatar-video/Movie-Studio generation placeholders, matching web
 * exactly. Re-checks permission state + cooldown fresh on every mount, so
 * toggling push in Settings changes whether this reappears with zero
 * extra wiring, same as web.
 */
export function PushNudgeBanner({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'enabling' | 'enabled'>('idle');

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) return;
      const state = await getPushPermissionState();
      if (state !== 'default') return;
      const dismissedAt = await AsyncStorage.getItem(DISMISSED_AT_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) return;
      setVisible(true);
    })();
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    void AsyncStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setVisible(false);
  };

  const enable = async () => {
    setStatus('enabling');
    try {
      const result = await registerForPushNotifications();
      if (result) {
        setStatus('enabled');
        setTimeout(() => setVisible(false), 2500);
      } else {
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  };

  const bg = isDark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)';
  const border = isDark ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.25)';
  const textColor = isDark ? '#F5F5F5' : '#111111';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
      }}
    >
      <Ionicons name="notifications-outline" size={16} color="#2563EB" />
      <Text style={{ flex: 1, fontSize: 12, color: textColor }}>
        {status === 'enabled'
          ? "You're set -- we'll notify you when it's ready."
          : 'This may take a few minutes. Enable notifications to know when it\'s ready?'}
      </Text>
      {status === 'idle' ? (
        <>
          <Pressable onPress={() => void enable()} accessibilityRole="button">
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB' }}>Enable</Text>
          </Pressable>
          <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={16} color={textColor} />
          </Pressable>
        </>
      ) : status === 'enabling' ? (
        <Text style={{ fontSize: 12, color: textColor }}>...</Text>
      ) : null}
    </View>
  );
}

export default PushNudgeBanner;
