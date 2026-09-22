import { AxiosResponse } from 'axios';
import { apiClient, apiEndpoints } from '@/services/api';
import { authenticatedFetch } from '@/services/api/auth.fetch';
import { API_BASE_URL } from '@/lib';
import { ApiResponse } from '@/types';
import {
  AppNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationListData,
  NotificationPreferences,
} from '../types';

/**
 * Real notification list -- ports web's listNotifications
 * (features/notifications/services/notifications.ts). `before` is an ISO
 * cursor (createdAt of the oldest already-loaded item), matching the
 * backend's `before` query param exactly.
 */
export async function listNotifications(before?: string, limit = 20): Promise<NotificationListData> {
  const response: AxiosResponse<ApiResponse<NotificationListData>> = await apiClient.get(
    apiEndpoints.notifications.list,
    { params: { before, limit } },
  );
  if (!response.data?.success || !response.data.data) {
    throw new Error(response.data?.message ?? 'Could not load notifications.');
  }
  return response.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const response: AxiosResponse<ApiResponse<{ unreadCount: number }>> = await apiClient.get(
    apiEndpoints.notifications.unreadCount,
  );
  return response.data?.data?.unreadCount ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(apiEndpoints.notifications.read(id));
}

export async function markAllNotificationsRead(): Promise<number> {
  const response: AxiosResponse<ApiResponse<{ markedCount: number }>> = await apiClient.patch(
    apiEndpoints.notifications.readAll,
  );
  return response.data?.data?.markedCount ?? 0;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response: AxiosResponse<ApiResponse<{ notificationPreferences: NotificationPreferences }>> =
    await apiClient.get(apiEndpoints.users.notificationPreferences);
  return response.data?.data?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  // Real fix (2026-09-13): the backend's updateNotificationPreferences
  // handler (user.controller.ts) reads req.body directly as
  // {inApp?, push?} -- it does NOT expect a {notificationPreferences: ...}
  // wrapper. Sending the wrapped shape made `incoming.inApp`/`incoming.push`
  // always undefined server-side, so every toggle "succeeded" (200 OK) but
  // silently merged nothing -- confirmed live: a toggled-off switch reverted
  // to its old value on the very next settings-panel reopen.
  const response: AxiosResponse<ApiResponse<{ notificationPreferences: NotificationPreferences }>> =
    await apiClient.patch(apiEndpoints.users.notificationPreferences, patch);
  if (!response.data?.success || !response.data.data) {
    throw new Error(response.data?.message ?? 'Could not update notification preferences.');
  }
  return response.data.data.notificationPreferences;
}

/**
 * Real, standing SSE connection for live in-app updates -- ports web's
 * streamNotifications. Manual fetch + ReadableStream reader (not
 * EventSource) for the same real reason web uses one: the endpoint needs a
 * Bearer Authorization header, which EventSource can't set. Frames are a
 * bare `data: {...}\n\n` per notification (no other event types on this
 * stream, unlike chat's SSE), so the parser here is deliberately simpler
 * than authenticated.ts's chat-stream parser.
 */
export function streamNotifications(onNotification: (notification: AppNotification) => void): { stop: () => void } {
  const controller = new AbortController();
  let stopped = false;

  const connect = async () => {
    if (stopped) return;
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}${apiEndpoints.notifications.stream}`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader available.');

      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const notification = JSON.parse(dataLine.slice('data: '.length)) as AppNotification;
            onNotification(notification);
          } catch {
            // Ignore malformed frames.
          }
        }
      }
    } catch {
      // Fall through to reconnect below unless stopped.
    }
    if (!stopped) {
      setTimeout(connect, 5000);
    }
  };

  void connect();

  return {
    stop: () => {
      stopped = true;
      controller.abort();
    },
  };
}
