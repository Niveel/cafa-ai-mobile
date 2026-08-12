import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';

import { AdMobConfig } from './admobConfig';
import { getGoogleMobileAds } from './googleMobileAds';
import { initializeAds } from './initializeAds';

let isShowing = false;

export async function showInterstitialAd(placement: string): Promise<boolean> {
  if (AdMobConfig.isExpoGo || isShowing) return false;

  try {
    await initializeAds();
    const ads = getGoogleMobileAds();
    if (!ads) return false;

    const { InterstitialAd, AdEventType } = ads;
    const properties = { placement, format: 'interstitial' };
    const ad = InterstitialAd.createForAdRequest(AdMobConfig.interstitialAdUnitId);
    isShowing = true;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let opened = false;

      const cleanup = () => {
        loadedUnsub();
        errorUnsub();
        openedUnsub();
        clickedUnsub();
        paidUnsub();
        closedUnsub();
        isShowing = false;
      };
      const finish = (shown: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(shown);
      };

      const loadedUnsub = ad.addAdEventListener(AdEventType.LOADED, () => {
        captureEvent(AnalyticsEvents.interstitialAdLoaded, properties);
        void ad.show().catch((error: unknown) => {
          captureEvent(AnalyticsEvents.interstitialAdFailed, {
            ...properties,
            error: error instanceof Error ? error.message : 'Failed to show interstitial ad.',
          });
          finish(false);
        });
      });
      const errorUnsub = ad.addAdEventListener(AdEventType.ERROR, (event: { message?: string; code?: string | number }) => {
        captureEvent(AnalyticsEvents.interstitialAdFailed, {
          ...properties,
          error: event.message ?? 'Interstitial ad failed.',
          code: event.code ?? null,
        });
        finish(false);
      });
      const openedUnsub = ad.addAdEventListener(AdEventType.OPENED, () => {
        opened = true;
        captureEvent(AnalyticsEvents.interstitialAdViewed, properties);
      });
      const clickedUnsub = ad.addAdEventListener(AdEventType.CLICKED, () => {
        captureEvent(AnalyticsEvents.interstitialAdClicked, properties);
      });
      const paidUnsub = ad.addAdEventListener(
        AdEventType.PAID,
        (event: { value: number; currency: string; precision: number | string }) => {
          captureEvent(AnalyticsEvents.adRevenueGenerated, { ...properties, ...event });
        },
      );
      const closedUnsub = ad.addAdEventListener(AdEventType.CLOSED, () => {
        captureEvent(AnalyticsEvents.interstitialAdClosed, properties);
        finish(opened);
      });

      try {
        ad.load();
      } catch (error) {
        captureEvent(AnalyticsEvents.interstitialAdFailed, {
          ...properties,
          error: error instanceof Error ? error.message : 'Failed to load interstitial ad.',
        });
        finish(false);
      }
    });
  } catch (error) {
    isShowing = false;
    captureEvent(AnalyticsEvents.interstitialAdFailed, {
      placement,
      format: 'interstitial',
      error: error instanceof Error ? error.message : 'Interstitial ad unavailable.',
    });
    return false;
  }
}
