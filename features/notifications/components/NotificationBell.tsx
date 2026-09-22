import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  streamNotifications,
} from '../services/notifications';
import type { AppNotification } from '../types';

/**
 * Real, RN port of web's NotificationBell.tsx. Same real data flow: one
 * listNotifications() fetch on mount plus a standing SSE subscription for
 * live updates (see services/notifications.ts's streamNotifications), the
 * list capped to 50 items. RN has no dropdown-on-outside-click primitive,
 * so the panel is a full-screen Modal rather than an absolutely-positioned
 * panel -- a disclosed platform adaptation, not a silent behavior change.
 */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({
  isDark,
  onNavigate,
}: {
  isDark: boolean;
  onNavigate?: (link: string) => void;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listNotifications();
        if (cancelled) return;
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      } catch {
        // Best-effort initial load; the badge simply stays at 0 on failure.
      }
    })();

    streamRef.current = streamNotifications((notification) => {
      setItems((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((count) => count + 1);
      AccessibilityInfo.announceForAccessibility(`${notification.title}. ${notification.body}`);
    });

    return () => {
      cancelled = true;
      streamRef.current?.stop();
    };
  }, []);

  const refreshUnreadCount = async () => {
    try {
      setUnreadCount(await getUnreadCount());
    } catch {
      // Keep the last known count on failure.
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setLoading(true);
    listNotifications()
      .then((data) => {
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleItemPress = (notification: AppNotification) => {
    if (!notification.read) {
      setItems((prev) => prev.map((item) => (item._id === notification._id ? { ...item, read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationRead(notification._id).catch(() => void refreshUnreadCount());
    }
    setIsOpen(false);
    if (notification.link) onNavigate?.(notification.link);
  };

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    void markAllNotificationsRead().catch(() => void refreshUnreadCount());
  };

  const iconColor = isDark ? '#F5F5F5' : '#111111';
  const bg = isDark ? '#0A0A0A' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const mutedText = isDark ? '#A3A3A3' : 'rgba(0,0,0,0.55)';

  return (
    <>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="notifications-outline" size={20} color={iconColor} />
        {unreadCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 3,
              backgroundColor: '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#F5F5F5' : '#111111' }}>
                Notifications
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {unreadCount > 0 ? (
                  <Pressable onPress={handleMarkAllRead} accessibilityRole="button">
                    <Text style={{ fontSize: 13, color: '#2563EB' }}>Mark all read</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setIsOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications"
                >
                  <Ionicons name="close" size={22} color={iconColor} />
                </Pressable>
              </View>
            </View>

            {items.length === 0 && !loading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: mutedText, fontSize: 13, textAlign: 'center' }}>
                  You&apos;re all caught up -- nothing here yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item._id}
                accessibilityRole="list"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleItemPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}. ${formatRelativeTime(item.createdAt)}`}
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: border,
                    }}
                  >
                    <View
                      accessibilityElementsHidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginTop: 6,
                        backgroundColor: item.read ? 'transparent' : '#2563EB',
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: item.read ? '400' : '600',
                          color: isDark ? '#F5F5F5' : '#111111',
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: mutedText, marginTop: 2 }}>{item.body}</Text>
                      <Text style={{ fontSize: 11, color: mutedText, marginTop: 4 }}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default NotificationBell;
