import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Switch, Text, View } from 'react-native';
import {
  getPushPermissionState,
  isPushSupported,
  registerForPushNotifications,
  type PushPermissionState,
} from '../services/pushRegistration';
import { getNotificationPreferences, updateNotificationPreferences } from '../services/notifications';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '../types';

/**
 * Real, RN port of web's NotificationSettingsPanel.tsx. Same 3 in-app
 * toggles plus 2 push toggles (no push toggle for creditsLow -- matches
 * the backend's PUSH_WORTHY_TYPES, which never includes credits types).
 * Push state is read-only here once granted (Android has no in-app
 * "disable" for a granted OS permission -- ports web's real limitation of
 * needing the system settings for that, same honest constraint).
 */
export function NotificationSettingsPanel({ isDark }: { isDark: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [pushState, setPushState] = useState<PushPermissionState>('default');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [loadedPrefs, state] = await Promise.all([getNotificationPreferences(), getPushPermissionState()]);
        setPrefs(loadedPrefs);
        setPushState(state);
      } catch {
        setError('Could not load notification settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Real fix (2026-09-13, Issue 13): push permission was only ever checked
  // once on mount -- if the user grants it from the OS Settings app (the
  // real, documented path once a permission is denied) while Cafa AI is
  // still open in the background, returning to this screen showed the
  // stale "denied"/"default" state until a full remount. Android has no
  // permission-change event to subscribe to directly, but re-checking on
  // every foreground resume (the same real signal iOS/Android apps use for
  // this) catches it immediately.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void getPushPermissionState().then(setPushState).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  const applyPatch = async (patch: Partial<NotificationPreferences>) => {
    const previous = prefs;
    const next: NotificationPreferences = {
      inApp: { ...prefs.inApp, ...patch.inApp },
      push: { ...prefs.push, ...patch.push },
    };
    setPrefs(next);
    try {
      const saved = await updateNotificationPreferences(patch);
      setPrefs(saved);
    } catch {
      setPrefs(previous);
      setError('Could not save that change. Please try again.');
    }
  };

  const handleEnablePush = async () => {
    setRegistering(true);
    setError(null);
    try {
      const result = await registerForPushNotifications();
      setPushState(result ? 'granted' : 'denied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setRegistering(false);
    }
  };

  const textColor = isDark ? '#F5F5F5' : '#111111';
  const mutedText = isDark ? '#A3A3A3' : 'rgba(0,0,0,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  if (loading) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color={textColor} />
      </View>
    );
  }

  const ToggleRow = ({
    label,
    description,
    value,
    onValueChange,
  }: {
    label: string;
    description: string;
    value: boolean;
    onValueChange: (next: boolean) => void;
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: border,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: textColor }}>{label}</Text>
        <Text style={{ fontSize: 12, color: mutedText, marginTop: 2 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 4 }}>
      {error ? <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}

      <Text style={{ fontSize: 12, fontWeight: '600', color: mutedText, marginBottom: 4, marginTop: 8 }}>
        IN-APP
      </Text>
      <ToggleRow
        label="Generation ready"
        description="Video, avatar video, and Movie Studio renders finishing."
        value={prefs.inApp.generationReady}
        onValueChange={(next) => void applyPatch({ inApp: { ...prefs.inApp, generationReady: next } })}
      />
      <ToggleRow
        label="Credits low or exhausted"
        description="A heads-up before you run out of credits."
        value={prefs.inApp.creditsLow}
        onValueChange={(next) => void applyPatch({ inApp: { ...prefs.inApp, creditsLow: next } })}
      />
      <ToggleRow
        label="Billing"
        description="Payment receipts and failed-payment alerts."
        value={prefs.inApp.billing}
        onValueChange={(next) => void applyPatch({ inApp: { ...prefs.inApp, billing: next } })}
      />

      <Text style={{ fontSize: 12, fontWeight: '600', color: mutedText, marginBottom: 4, marginTop: 20 }}>
        PUSH
      </Text>
      <Text style={{ fontSize: 12, color: mutedText, marginBottom: 8 }}>
        Real notifications on this device, even when Cafa AI isn&apos;t open.
      </Text>

      {!isPushSupported() ? (
        <Text style={{ fontSize: 13, color: mutedText }}>
          Push notifications require a physical device.
        </Text>
      ) : pushState === 'denied' ? (
        <Text style={{ fontSize: 13, color: mutedText }}>
          Notifications are blocked for this app. Enable them in your device&apos;s system settings to turn this on.
        </Text>
      ) : pushState === 'granted' ? (
        <>
          <ToggleRow
            label="Generation ready"
            description="Push when a video, avatar, or render finishes."
            value={prefs.push.generationReady}
            onValueChange={(next) => void applyPatch({ push: { ...prefs.push, generationReady: next } })}
          />
          <ToggleRow
            label="Billing"
            description="Push on a failed payment."
            value={prefs.push.billing}
            onValueChange={(next) => void applyPatch({ push: { ...prefs.push, billing: next } })}
          />
        </>
      ) : (
        <Text
          onPress={() => void handleEnablePush()}
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#2563EB',
            paddingVertical: 10,
            opacity: registering ? 0.5 : 1,
          }}
        >
          {registering ? 'Enabling...' : 'Turn on push notifications'}
        </Text>
      )}
    </View>
  );
}

export default NotificationSettingsPanel;
