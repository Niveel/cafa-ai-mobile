import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import TikTokEventsModule, { type TikTokEventProperties } from '@/modules/tiktok-events';

export const TIKTOK_APP_ID = '7650349998273527815';
const CONSENT_STORAGE_KEY = 'cafa_ai_tiktok_ad_tracking_consent_v1';

export type TikTokTrackingConsent = boolean | null;

let initialized = false;
let trackingAllowed = false;

export async function getTikTokTrackingConsent(): Promise<TikTokTrackingConsent> {
  const stored = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
  if (stored === 'granted') return true;
  if (stored === 'denied') return false;
  return null;
}

export async function initializeTikTokEvents() {
  if (Platform.OS !== 'android' || !TikTokEventsModule) return undefined;
  const consent = await getTikTokTrackingConsent();
  trackingAllowed = consent === true;

  if (!initialized) {
    initialized = await TikTokEventsModule.initialize(TIKTOK_APP_ID, trackingAllowed, __DEV__);
  } else if (trackingAllowed) {
    TikTokEventsModule.startTracking();
  }

  return consent;
}

export async function setTikTokTrackingConsent(allowed: boolean) {
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, allowed ? 'granted' : 'denied');
  trackingAllowed = allowed;

  if (Platform.OS !== 'android' || !TikTokEventsModule) return;
  if (!allowed) {
    if (initialized) TikTokEventsModule.disableTracking();
    initialized = false;
    return;
  }
  if (!initialized) {
    initialized = await TikTokEventsModule.initialize(TIKTOK_APP_ID, allowed, __DEV__);
  } else if (allowed) {
    TikTokEventsModule.startTracking();
  }
}

export function trackTikTokEvent(name: string, properties: TikTokEventProperties = {}, eventId?: string) {
  if (!trackingAllowed || !initialized || !TikTokEventsModule) return;
  TikTokEventsModule.trackEvent(name, properties, eventId ?? null);
}

export function identifyTikTokUser(user: { id: string; name?: string | null; email?: string | null }) {
  if (!trackingAllowed || !initialized || !TikTokEventsModule) return;
  TikTokEventsModule.identify(user.id, null, null, null);
}

export function resetTikTokUser() {
  if (!trackingAllowed || !initialized || !TikTokEventsModule) return;
  TikTokEventsModule.logout();
}

export const TikTokEvents = {
  login: 'Login',
  registration: 'Registration',
  subscribe: 'Subscribe',
} as const;
