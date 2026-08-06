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

import { useMemo } from 'react';
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

  return useMemo(() => {
    const { pathname, isModalOpen, isKeyboardOpen } = options;

    if (!isAuthenticated) {
      return { showAds: false, reason: 'unauthenticated' };
    }

    if (isPro || activeTier !== 'free') {
      return { showAds: false, reason: 'paid-user' };
    }

    const backendTier = authUser?.subscriptionTier ?? 'free';
    if (backendTier !== 'free') {
      return { showAds: false, reason: 'paid-user-backend' };
    }

    const isAllowed = AdMobConfig.allowedBannerRoutes.has(pathname);
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
  }, [isAuthenticated, isPro, activeTier, authUser?.subscriptionTier, options]);
}
