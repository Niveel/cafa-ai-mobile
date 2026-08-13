import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';

import { AdMobConfig } from './admobConfig';
import { getGoogleMobileAds } from './googleMobileAds';
import { initializeAds } from './initializeAds';

let isShowing = false;
let preparedAd: ReturnType<NonNullable<ReturnType<typeof getGoogleMobileAds>>['InterstitialAd']['createForAdRequest']> | null = null;
let preloadPromise: Promise<boolean> | null = null;

export async function preloadInterstitialAd(): Promise<boolean> {
  if (AdMobConfig.isExpoGo) return false;
  if (preparedAd) return true;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await initializeAds();
      const ads = getGoogleMobileAds();
      if (!ads) return false;

      const { InterstitialAd, AdEventType } = ads;
      const ad = InterstitialAd.createForAdRequest(AdMobConfig.interstitialAdUnitId);

      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (loaded: boolean) => {
          if (settled) return;
          settled = true;
          loadedUnsub();
          errorUnsub();
          clearTimeout(timeout);
          if (loaded) preparedAd = ad;
          resolve(loaded);
        };
        const loadedUnsub = ad.addAdEventListener(AdEventType.LOADED, () => {
          captureEvent(AnalyticsEvents.interstitialAdLoaded, {
            placement: 'repo_tools_preload',
            format: 'interstitial',
          });
          finish(true);
        });
        const errorUnsub = ad.addAdEventListener(
          AdEventType.ERROR,
          (event: { message?: string; code?: string | number }) => {
            captureEvent(AnalyticsEvents.interstitialAdFailed, {
              placement: 'repo_tools_preload',
              format: 'interstitial',
              error: event.message ?? 'Interstitial preload failed.',
              code: event.code ?? null,
            });
            finish(false);
          },
        );
        const timeout = setTimeout(() => finish(false), 20_000);

        try {
          ad.load();
        } catch {
          finish(false);
        }
      });
    } catch {
      return false;
    } finally {
      preloadPromise = null;
    }
  })();

  return preloadPromise;
}

export async function showInterstitialAd(placement: string): Promise<boolean> {
  if (AdMobConfig.isExpoGo || isShowing) return false;

  try {
    const ready = await preloadInterstitialAd();
    if (!ready) return false;
    const ads = getGoogleMobileAds();
    if (!ads) return false;

    const { AdEventType } = ads;
    const properties = { placement, format: 'interstitial' };
    const ad = preparedAd;
    if (!ad) return false;
    preparedAd = null;
    isShowing = true;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let opened = false;

      const cleanup = () => {
        errorUnsub();
        openedUnsub();
        clickedUnsub();
        paidUnsub();
        closedUnsub();
        isShowing = false;
        void preloadInterstitialAd();
      };
      const finish = (shown: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(shown);
      };

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

      void ad.show().catch((error: unknown) => {
        captureEvent(AnalyticsEvents.interstitialAdFailed, {
          ...properties,
          error: error instanceof Error ? error.message : 'Failed to show interstitial ad.',
        });
        finish(false);
      });
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
