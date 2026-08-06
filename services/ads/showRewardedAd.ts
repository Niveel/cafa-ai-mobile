/**
 * Example integration for showing a rewarded ad and granting a reward.
 *
 * This is a documented example / service boundary. It is NOT yet wired into
 * any screen. Future screens can import this helper to trigger rewarded ads.
 *
 * IMPORTANT SECURITY REQUIREMENT:
 * The reward must be validated and granted by the backend. Do NOT grant
 * credits, generations, or features solely on the client-side completion
 * event. The client event is a signal to call the backend, which must:
 * 1. Verify the user is authenticated and on the free tier.
 * 2. Verify the reward type is eligible.
 * 3. Apply the credit / generation / feature to the user's account.
 * 4. Return the updated usage/quota so the UI can refresh.
 *
 * Rewards must only be granted after the rewarded-ad completion event.
 * Never grant rewards for unlocking purchases, subscriptions, or permanent
 * premium access.
 *
 * Example usage in a future screen:
 *
 * import { showRewardedAd } from '@/services/ads/showRewardedAd';
 *
 * async function handleWatchAdForImage() {
 *   await showRewardedAd({
 *     rewardType: 'image_generation',
 *     onRewardEarned: async (reward) => {
 *       // TODO: call backend to validate and grant the reward securely.
 *       await grantRewardOnBackend({ type: reward.type, amount: reward.amount });
 *     },
 *   });
 * }
 */

import { RewardedAd, RewardedAdEventType, AdEventType, RewardedAdReward } from 'react-native-google-mobile-ads';
import { AdMobConfig } from './admobConfig';
import { captureEvent } from '@/lib/analytics/posthog';
import { AnalyticsEvents } from '@/lib/analytics/events';

export type RewardedAdRewardType = 'image_generation' | 'video_generation' | 'chat_credit' | 'tts_credit';

export type ShowRewardedAdOptions = {
  rewardType: RewardedAdRewardType;
  onRewardEarned: (reward: { type: RewardedAdRewardType; amount: number }) => void | Promise<void>;
  onError?: (error: Error) => void;
};

let showingRef = false;

export async function showRewardedAd({ rewardType, onRewardEarned, onError }: ShowRewardedAdOptions): Promise<void> {
  if (AdMobConfig.isExpoGo) {
    const msg = 'Rewarded ads are not available in Expo Go.';
    if (__DEV__) {
      console.warn('[ads:rewarded]', msg);
    }
    onError?.(new Error(msg));
    return;
  }

  if (showingRef) {
    const msg = 'A rewarded ad is already showing.';
    if (__DEV__) {
      console.warn('[ads:rewarded]', msg);
    }
    onError?.(new Error(msg));
    return;
  }

  try {
    showingRef = true;
    const ad = RewardedAd.createForAdRequest(AdMobConfig.rewardedAdUnitId);
    let rewardEarned = false;

    const loadedUnsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      captureEvent(AnalyticsEvents.rewardedAdLoaded, { rewardType });
    });

      const errorUnsub = ad.addAdEventListener(AdEventType.ERROR, (evt: { message?: string; code?: string | number }) => {
      const message = evt?.message ?? 'Unknown rewarded ad error';
      captureEvent(AnalyticsEvents.rewardedAdFailed, { rewardType, error: message });
      if (__DEV__) {
        console.warn('[ads:rewarded] Error:', message);
      }
      onError?.(new Error(message));
      loadedUnsub();
      errorUnsub();
      earnedUnsub();
      closedUnsub();
      showingRef = false;
    });

      const earnedUnsub = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: RewardedAdReward) => {
        rewardEarned = true;
        captureEvent(AnalyticsEvents.rewardedAdEarned, {
          rewardType,
          adRewardType: reward.type,
          adRewardAmount: reward.amount,
        });
      },
    );

    const closedUnsub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      captureEvent(AnalyticsEvents.rewardedAdClosed, {
        rewardType,
        rewardEarned,
      });

      if (rewardEarned) {
        void onRewardEarned({ type: rewardType, amount: 1 });
      } else {
        if (__DEV__) {
          console.log('[ads:rewarded] User closed early; no reward granted.');
        }
      }

      loadedUnsub();
      errorUnsub();
      earnedUnsub();
      closedUnsub();
      showingRef = false;
    });

    await ad.load();
    await ad.show();
  } catch (err) {
    showingRef = false;
    const message = err instanceof Error ? err.message : 'Failed to show rewarded ad';
    if (__DEV__) {
      console.warn('[ads:rewarded] Show error:', message);
    }
    onError?.(new Error(message));
  }
}
