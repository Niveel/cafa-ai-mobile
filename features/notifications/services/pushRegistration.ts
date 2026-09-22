import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient, apiEndpoints } from '@/services/api';

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
 */
export function isPushSupported(): boolean {
  return Device.isDevice;
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

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await apiClient.post(apiEndpoints.notifications.pushTokens, {
    token,
    deviceId: Constants.sessionId ?? undefined,
    platform: Platform.OS,
  });

  return { token };
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  await apiClient.delete(apiEndpoints.notifications.pushTokens, { data: { token } });
}

/**
 * Deep-link handling for a tapped push notification -- ports web's sw.js
 * notificationclick handler (extracts `link`, defaults to "/"). Call once
 * near app start; the returned subscription should be removed on unmount.
 */
export function addNotificationResponseListener(onLink: (link: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link;
    if (typeof link === 'string' && link) {
      onLink(link);
    }
  });
}
