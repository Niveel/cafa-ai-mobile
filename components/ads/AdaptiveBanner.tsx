/**
 * Reusable anchored adaptive banner component.
 *
 * Renders a Google AdMob banner only when:
 * - the user is authenticated and on the free tier;
 * - the route is allow-listed;
 * - no modal is open;
 * - the keyboard is not visible;
 * - the AdMob SDK has been initialized successfully.
 *
 * The banner is placed at the bottom of the screen, respecting safe-area insets.
 * It is unmounted (not just hidden) when any visibility condition fails, freeing
 * native resources and preventing accidental clicks.
 */

import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdMobConfig } from '@/services/ads/admobConfig';
import { initializeAds, getAdsInitialized } from '@/services/ads/initializeAds';
import { getGoogleMobileAds } from '@/services/ads/googleMobileAds';
import { useAdVisibility, useAppTheme } from '@/hooks';
import { captureEvent } from '@/lib/analytics/posthog';
import { AnalyticsEvents } from '@/lib/analytics/events';

type AdaptiveBannerProps = {
  /** Current pathname from expo-router usePathname(). */
  pathname: string;
  /** Set to true when a modal or overlay is active on the parent screen. */
  isModalOpen?: boolean;
};

export function AdaptiveBanner({ pathname, isModalOpen = false }: AdaptiveBannerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  // Track keyboard visibility so the banner is hidden while the keyboard is open.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Lazy-initialize the AdMob SDK when this banner mounts.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (AdMobConfig.isExpoGo) {
        if (__DEV__) {
          console.log('[ads:runtime]', {
            pathname,
            expoGo: true,
            nativeModuleAvailable: false,
            initializationCompleted: false,
            reason: 'expo-go-not-supported',
          });
        }
        return;
      }
      if (!cancelled) {
        await initializeAds();
      }
      if (!cancelled) {
        const initialized = getAdsInitialized();
        const nativeModuleAvailable = getGoogleMobileAds() !== null;
        setSdkReady(initialized);
        if (__DEV__) {
          console.log('[ads:runtime]', {
            pathname,
            expoGo: false,
            nativeModuleAvailable,
            initializationCompleted: initialized,
            bannerUnitId: AdMobConfig.bannerAdUnitId,
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const { showAds } = useAdVisibility({
    pathname,
    isModalOpen,
    isKeyboardOpen: keyboardVisible,
  });

  const onAdLoaded = useCallback(() => {
    captureEvent(AnalyticsEvents.adBannerLoaded, { pathname });
  }, [pathname]);

  const onAdFailed = useCallback(
    (error: { message: string; code: number | string }) => {
      captureEvent(AnalyticsEvents.adBannerFailed, {
        pathname,
        error: error.message,
        code: error.code,
      });
      if (__DEV__) {
        console.warn('[ads:banner] Failed to load:', error.message);
      }
    },
    [pathname],
  );

  if (!showAds || !sdkReady) {
    return null;
  }

  const ads = getGoogleMobileAds();
  if (!ads) return null;
  const { BannerAd, BannerAdSize } = ads;

  return (
    <View
      style={{
        width: '100%',
        paddingBottom: insets.bottom,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BannerAd
        unitId={AdMobConfig.bannerAdUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailed}
        onAdImpression={() => {
          captureEvent(AnalyticsEvents.adBannerViewed, { pathname, format: 'banner' });
        }}
        onAdClicked={() => {
          captureEvent(AnalyticsEvents.adBannerClicked, { pathname, format: 'banner' });
        }}
        onPaid={(event) => {
          captureEvent(AnalyticsEvents.adRevenueGenerated, {
            pathname,
            format: 'banner',
            value: event.value,
            currency: event.currency,
            precision: event.precision,
          });
        }}
      />
    </View>
  );
}
