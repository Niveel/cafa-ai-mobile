// Real, matches web's types/notification.types.ts and the backend's
// Notification.model.ts NOTIFICATION_TYPES exactly (9 values) -- do not add
// types here that don't exist server-side.
export type NotificationType =
  | 'video_ready'
  | 'avatar_video_ready'
  | 'movie_studio_render_ready'
  | 'image_ready'
  | 'chat_response_ready'
  | 'credits_low'
  | 'credits_exhausted'
  | 'subscription_payment_succeeded'
  | 'subscription_payment_failed';

export type AppNotification = {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationListData = { items: AppNotification[]; unreadCount: number };

// Real, matches web -- 3 categories, not one flag per type. `push` has no
// `creditsLow` toggle at all (credits types are never push-worthy on the
// backend, see PUSH_WORTHY_TYPES in notification.service.ts).
export type NotificationPreferences = {
  inApp: { generationReady: boolean; creditsLow: boolean; billing: boolean };
  push: { generationReady: boolean; billing: boolean };
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inApp: { generationReady: true, creditsLow: true, billing: true },
  push: { generationReady: true, billing: true },
};
