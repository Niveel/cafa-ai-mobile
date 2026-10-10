import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppTheme, useI18n } from '@/hooks';
import { getPushPermissionState, isPushSupported, registerForPushNotifications } from '@/features/notifications/services/pushRegistration';

import { StudioIcon } from './StudioIcon';
import { useStudioPalette } from '../theme';

const DISMISSED_AT_KEY = 'cafa_push_nudge_dismissed_at'; // shared with the app's own nudge banner
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The push nudge shown inside the scene video overlay: "This may take a few minutes. Enable notifications to
 * know when it's ready?" Same permission, cooldown and storage key as the app-wide banner, with the Studio icon.
 */
export function StudioPushNudge() {
  const { isDark, colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'enabling' | 'enabled'>('idle');

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) return;
      if ((await getPushPermissionState()) !== 'default') return;
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

  return (
    <View
      className="mt-3 flex-row rounded-xl border p-3"
      style={{ gap: 8, borderColor: P.border, backgroundColor: `${P.accent}${isDark ? '33' : '14'}` }}
    >
      <View style={{ marginTop: 2 }}>
        <StudioIcon name="bell-ring" size={16} color="#A855F7" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 17 }}>
          {status === 'enabled' ? t('studio.scenes.nudgeDone') : t('studio.scenes.nudge')}
        </Text>
        {status === 'idle' ? (
          <Pressable onPress={() => void enable()} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Text style={{ color: P.accentText, fontSize: 12, fontWeight: '700' }}>{t('studio.scenes.nudgeEnable')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('studio.scenes.nudgeDismiss')}
        style={{ opacity: 0.6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <StudioIcon name="x" size={14} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}
