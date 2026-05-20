import type { PostHog } from 'posthog-react-native';

let posthogClient: PostHog | null = null;

export function bindPostHogClient(client: PostHog | null) {
  posthogClient = client;
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  try {
    posthogClient?.capture(event, properties as any);
  } catch {}
}

export function screenEvent(name: string, properties?: Record<string, unknown>) {
  try {
    posthogClient?.screen(name, properties as any);
  } catch {}
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  try {
    posthogClient?.identify(userId, properties as any);
  } catch {}
}

export function resetAnalyticsUser() {
  try {
    posthogClient?.reset();
  } catch {}
}
