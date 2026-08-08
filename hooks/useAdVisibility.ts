/**
 * Hook that determines whether ads should be visible for the current user
 * and route.
 *
 * Ads must only show when:
 * - the user is authenticated;
 * - the user is on the free tier;
 * - the current route is explicitly allow-listed;
 * - no modal or keyboard state makes the placement unsafe.
 *
 * Paid Smart, Pro, and Max users must never see ads.
 */

import { useEffect, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { AdMobConfig } from '@/services/ads/admobConfig';

export type AdVisibilityOptions = {
  /** The current pathname from expo-router. */
  pathname: string;
  /** True when a modal or overlay is open that should hide ads. */
  isModalOpen?: boolean;
  /** True when the software keyboard is visible. */
  isKeyboardOpen?: boolean;
};

export function useAdVisibility(options: AdVisibilityOptions): {
  showAds: boolean;
  reason: string;
} {
  const { isAuthenticated, authUser } = useAppContext();
  const { activeTier, isPro } = useRevenueCat();
  const { pathname, isModalOpen = false, isKeyboardOpen = false } = options;
  const backendTier = authUser?.subscriptionTier ?? 'free';
  const isAllowed = AdMobConfig.allowedBannerRoutes.has(pathname);

  const decision = useMemo(() => {
    if (!isAuthenticated) {
      return { showAds: false, reason: 'unauthenticated' };
    }

    if (isPro || activeTier !== 'free') {
      return { showAds: false, reason: 'paid-user' };
    }

    if (backendTier !== 'free') {
      return { showAds: false, reason: 'paid-user-backend' };
    }

    if (!isAllowed) {
      return { showAds: false, reason: 'route-not-allowed' };
    }

    if (isModalOpen) {
      return { showAds: false, reason: 'modal-open' };
    }

    if (isKeyboardOpen) {
      return { showAds: false, reason: 'keyboard-open' };
    }

    return { showAds: true, reason: 'visible' };
  }, [activeTier, backendTier, isAllowed, isAuthenticated, isKeyboardOpen, isModalOpen, isPro]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[ads:visibility]', {
      pathname,
      authenticated: isAuthenticated,
      revenueCatTier: activeTier,
      revenueCatIsPro: isPro,
      revenueCatFree: !isPro && activeTier === 'free',
      backendTier,
      backendFree: backendTier === 'free',
      allowedBannerRoutes: [...AdMobConfig.allowedBannerRoutes],
      routeAllowed: isAllowed,
      modalOpen: isModalOpen,
      keyboardOpen: isKeyboardOpen,
      showAds: decision.showAds,
      reason: decision.reason,
    });
  }, [activeTier, backendTier, decision.reason, decision.showAds, isAllowed, isAuthenticated, isKeyboardOpen, isModalOpen, isPro, pathname]);

  return decision;
}
