import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { TikTokEventProperties } from './TikTokEvents.types';

declare class TikTokEventsModule extends NativeModule {
  isInitialized(): boolean;
  initialize(appId: string, trackingEnabled: boolean, debug: boolean): Promise<boolean>;
  startTracking(): void;
  disableTracking(): void;
  trackEvent(name: string, properties: TikTokEventProperties, eventId: string | null): void;
  identify(externalId: string, userName: string | null, phone: string | null, email: string | null): void;
  logout(): void;
}

export default requireOptionalNativeModule<TikTokEventsModule>('TikTokEvents');
