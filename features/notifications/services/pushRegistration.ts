import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient, apiEndpoints } from '@/services/api';
import { resolveNotificationTarget } from '@/utils/notificationRoute';

// Real, foreground presentation behavior -- without this, expo-notifications
// silently drops a notification received while the app is foregrounded on
// some platforms. The backend already suppresses push entirely while this
// app's own SSE connection is live and presence-tracked (see
// notification.service.ts's isUserPresent check), so a push arriving here
// in the foreground is the rarer edge case (e.g. presence just expired) --
// still worth surfacing, not suppressing twice.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPermissionState = 'unsupported' | 'denied' | 'default' | 'granted';

/**
 * Real device gate -- push tokens are meaningless on a simulator/emulator
 * (no real FCM/APNs registration), matching expo-notifications' own
 * documented limitation. Ports the same intent as web's isPushSupported().
 * Dev builds also allow Android emulators: a Google APIs system image has
 * Play services and receives real FCM pushes, which is how push is tested.
 */
export function isPushSupported(): boolean {
  if (Device.isDevice) return true;
  return __DEV__ && Platform.OS === 'android';
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'default';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10264D',
  });
}

/**
 * Real, eager-registration flow -- ports web's enablePushNotifications.
 * Only ever call this from a user-initiated action (settings toggle or the
 * nudge banner's "Enable" tap), never automatically on app load, matching
 * web's own explicit discipline here.
 */
export async function registerForPushNotifications(): Promise<{ token: string } | null> {
  if (!isPushSupported()) {
    throw new Error('Push notifications require a physical device.');
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    throw new Error('Missing EAS project id -- cannot request a push token.');
  }

  const token = await fetchAndSendPushToken(projectId);
  return { token };
}

const REGISTERED_TOKEN_KEY = 'cafa.push.registeredToken';

async function fetchAndSendPushToken(projectId: string): Promise<string> {
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (__DEV__) console.log('[push] expo push token', token);

  await apiClient.post(apiEndpoints.notifications.pushTokens, {
    token,
    deviceId: Constants.sessionId ?? undefined,
    platform: Platform.OS,
  });
  await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token).catch(() => {});
  return token;
}

/**
 * Re-sends this device's token for the signed-in user when permission is
 * already granted. Registration otherwise only happens at the moment the
 * permission is first granted, so a failed first attempt, a different account
 * signing in on the same device, or a rotated token would leave the backend
 * with nothing to send to. The backend upserts, so repeating this is safe.
 * Never prompts.
 */
export async function syncPushTokenIfPermitted(): Promise<void> {
  if (!isPushSupported()) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureAndroidChannel();
  await fetchAndSendPushToken(projectId);
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  await apiClient.delete(apiEndpoints.notifications.pushTokens, { data: { token } });
}

/**
 * Detaches this device from the signed-in account. Call before the session
 * is cleared (the delete is authenticated), so the next user of this device
 * doesn't receive the previous user's pushes.
 */
export async function unregisterCurrentPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY).catch(() => null);
  if (!token) return;
  try {
    await unregisterPushNotifications(token);
  } finally {
    await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY).catch(() => {});
  }
}

/**
 * Deep-link handling for a tapped push notification -- ports web's sw.js
 * notificationclick handler (extracts `link`, defaults to "/"). Call once
 * near app start; the returned subscription should be removed on unmount.
 */
export function addNotificationResponseListener(onLink: (link: string) => void) {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const data = (response?.notification.request.content.data ?? {}) as Record<string, unknown>;
    // Open the exact finished item when the push carries its type + ids
    // (same data as the in-app notification); otherwise fall back to `link`.
    onLink(resolveNotificationTarget({
      type: typeof data.type === 'string' ? data.type : null,
      link: typeof data.link === 'string' ? data.link : null,
      metadata: (data.metadata && typeof data.metadata === 'object' ? data.metadata : data) as Record<string, unknown>,
    }));
  };
  // A tap that cold-started the app fires before any listener exists.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handle(response);
    })
    .catch(() => {});
  return Notifications.addNotificationResponseReceivedListener(handle);
}
