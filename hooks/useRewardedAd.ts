/**
 * Standard rewarded-ad hook.
 *
 * Features:
 * - Preloads an ad on mount.
 * - Exposes isLoaded, isLoading, show, and error state.
 * - Listens for the earned-reward event.
 * - Grants nothing when the user closes early.
 * - Reloads the next ad after close.
 * - Prevents double rewards.
 * - Prevents multiple simultaneous show calls.
 * - Uses the correct Android or iOS production ID.
 * - Uses TestIds.REWARDED during development.
 *
 * IMPORTANT: The reward must be validated server-side before granting credits.
 * Never grant premium access, subscriptions, or permanent unlocks via rewarded ads.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RewardedAd as RewardedAdInstance, RewardedAdReward } from 'react-native-google-mobile-ads';
import { AdMobConfig } from '@/services/ads/admobConfig';
import { getGoogleMobileAds } from '@/services/ads/googleMobileAds';
import { captureEvent } from '@/lib/analytics/posthog';
import { AnalyticsEvents } from '@/lib/analytics/events';

export type RewardType = 'image_generation' | 'video_generation' | 'chat_credit' | 'tts_credit';

export type ShowRewardedAdOptions = {
  rewardType: RewardType;
  onRewardEarned: (reward: { type: string; amount: number }) => void | Promise<void>;
  onError?: (error: Error) => void;
};

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rewardedAdRef = useRef<RewardedAdInstance | null>(null);
  const rewardEarnedRef = useRef(false);
  const showingRef = useRef(false);

  const createAndLoadAd = useCallback(() => {
    if (AdMobConfig.isExpoGo) {
      if (__DEV__) {
        console.log('[ads:rewarded] Skipped load in Expo Go.');
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ads = getGoogleMobileAds();
      if (!ads) return;
      const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
      const ad = RewardedAd.createForAdRequest(AdMobConfig.rewardedAdUnitId);
      rewardedAdRef.current = ad;

      const loadedUnsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setIsLoaded(true);
        setIsLoading(false);
        captureEvent(AnalyticsEvents.rewardedAdLoaded, {});
        if (__DEV__) {
          console.log('[ads:rewarded] Ad loaded.');
        }
      });

      const errorUnsub = ad.addAdEventListener(AdEventType.ERROR, (evt: { message?: string; code?: string | number }) => {
        setIsLoaded(false);
        setIsLoading(false);
        const message = evt?.message ?? 'Unknown rewarded ad error';
        setError(message);
        captureEvent(AnalyticsEvents.rewardedAdFailed, { error: message });
        if (__DEV__) {
          console.warn('[ads:rewarded] Load error:', message);
        }
      });

      const openedUnsub = ad.addAdEventListener(AdEventType.OPENED, () => {
        captureEvent(AnalyticsEvents.rewardedAdStarted, {});
        if (__DEV__) {
          console.log('[ads:rewarded] Ad opened.');
        }
      });

      const earnedUnsub = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: RewardedAdReward) => {
          rewardEarnedRef.current = true;
          captureEvent(AnalyticsEvents.rewardedAdEarned, {
            rewardType: reward.type,
            rewardAmount: reward.amount,
          });
          if (__DEV__) {
            console.log('[ads:rewarded] Reward earned:', reward.type, reward.amount);
          }
        },
      );

      const closedUnsub = ad.addAdEventListener(AdEventType.CLOSED, () => {
        captureEvent(AnalyticsEvents.rewardedAdClosed, {
          rewardEarned: rewardEarnedRef.current,
        });
        if (__DEV__) {
          console.log(
            '[ads:rewarded] Ad closed. Earned:',
            rewardEarnedRef.current,
          );
        }

        // Reset for the next ad cycle.
        rewardEarnedRef.current = false;
        showingRef.current = false;
        setIsLoaded(false);

        // Preload the next ad.
        createAndLoadAd();
      });

      // Clean up listeners when we recreate the ad.
      const cleanup = () => {
        loadedUnsub();
        errorUnsub();
        openedUnsub();
        earnedUnsub();
        closedUnsub();
      };

      // Store cleanup on the ad object so we can access it later.
      (ad as any).__cleanupListeners = cleanup;

      ad.load();
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to create rewarded ad';
      setError(message);
      if (__DEV__) {
        console.warn('[ads:rewarded] Creation error:', message);
      }
    }
  }, []);

  useEffect(() => {
    createAndLoadAd();
    return () => {
      const ad = rewardedAdRef.current;
      if (ad && (ad as any).__cleanupListeners) {
        (ad as any).__cleanupListeners();
      }
    };
  }, [createAndLoadAd]);

  const show = useCallback(
    async ({ rewardType, onRewardEarned, onError }: ShowRewardedAdOptions) => {
      if (AdMobConfig.isExpoGo) {
        const msg = 'Rewarded ads are not available in Expo Go.';
        if (__DEV__) {
          console.warn('[ads:rewarded]', msg);
        }
        onError?.(new Error(msg));
        return;
      }

      if (showingRef.current) {
        const msg = 'A rewarded ad is already showing.';
        if (__DEV__) {
          console.warn('[ads:rewarded]', msg);
        }
        onError?.(new Error(msg));
        return;
      }

      if (!isLoaded || !rewardedAdRef.current) {
        const msg = 'Rewarded ad is not loaded yet.';
        if (__DEV__) {
          console.warn('[ads:rewarded]', msg);
        }
        onError?.(new Error(msg));
        return;
      }

      try {
        showingRef.current = true;
        rewardEarnedRef.current = false;
        await rewardedAdRef.current.show();

        if (rewardEarnedRef.current) {
          // Grant the reward. IMPORTANT: this must be validated server-side.
          // TODO: call backend to validate and grant the reward securely.
          await onRewardEarned({ type: rewardType, amount: 1 });
        } else {
          if (__DEV__) {
            console.log('[ads:rewarded] User closed early; no reward granted.');
          }
        }
      } catch (err) {
        showingRef.current = false;
        const message = err instanceof Error ? err.message : 'Failed to show rewarded ad';
        if (__DEV__) {
          console.warn('[ads:rewarded] Show error:', message);
        }
        onError?.(new Error(message));
      }
    },
    [isLoaded],
  );

  return {
    isLoaded,
    isLoading,
    error,
    show,
  };
}
