import type { RewardedAdReward } from 'react-native-google-mobile-ads';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';

import { AdMobConfig } from './admobConfig';
import { getGoogleMobileAds } from './googleMobileAds';
import { initializeAds } from './initializeAds';
import type { AdRewardKind } from './rewardApi';

export type RewardedAdResult =
  | { status: 'completed'; adReward: RewardedAdReward }
  | { status: 'cancelled' };

export type ShowRewardedAdOptions = {
  rewardType: AdRewardKind;
  sessionId: string;
  ssvUserId: string;
  ssvCustomData: string;
  placement?: string;
};

let isShowing = false;

export async function showRewardedAd({
  rewardType,
  sessionId,
  ssvUserId,
  ssvCustomData,
  placement = 'limit_notice',
}: ShowRewardedAdOptions): Promise<RewardedAdResult> {
  if (AdMobConfig.isExpoGo) throw new Error('Rewarded ads are unavailable in Expo Go.');
  if (isShowing) throw new Error('A rewarded ad is already showing.');

  if (__DEV__) console.log('[ads:rewarded:prepare]', { rewardType, sessionId, placement });
  await initializeAds();
  const ads = getGoogleMobileAds();
  if (!ads) throw new Error('Google Mobile Ads is unavailable in this build.');

  const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
  const properties = { rewardType, sessionId, placement, format: 'rewarded' };
  const ad = RewardedAd.createForAdRequest(AdMobConfig.rewardedAdUnitId, {
    serverSideVerificationOptions: {
      userId: ssvUserId,
      customData: ssvCustomData,
    },
  });

  isShowing = true;
  return new Promise<RewardedAdResult>((resolve, reject) => {
    let earnedReward: RewardedAdReward | null = null;
    let settled = false;
    const loadTimeout = setTimeout(() => fail(new Error('Rewarded ad took too long to load.')), 20_000);

    const cleanup = () => {
      loadedUnsub();
      errorUnsub();
      openedUnsub();
      paidUnsub();
      earnedUnsub();
      closedUnsub();
      clearTimeout(loadTimeout);
      isShowing = false;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      captureEvent(AnalyticsEvents.rewardedAdFailed, { ...properties, error: error.message });
      cleanup();
      reject(error);
    };

    const loadedUnsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (__DEV__) console.log('[ads:rewarded:loaded]', properties);
      captureEvent(AnalyticsEvents.rewardedAdLoaded, properties);
      void ad.show().catch((error) => fail(error instanceof Error ? error : new Error('Failed to show rewarded ad.')));
    });
    const errorUnsub = ad.addAdEventListener(
      AdEventType.ERROR,
      (event: { message?: string }) => fail(new Error(event.message ?? 'Rewarded ad failed.')),
    );
    const openedUnsub = ad.addAdEventListener(AdEventType.OPENED, () => {
      if (__DEV__) console.log('[ads:rewarded:opened]', properties);
      captureEvent(AnalyticsEvents.rewardedAdStarted, properties);
    });
    const paidUnsub = ad.addAdEventListener(
      AdEventType.PAID,
      (event: { value: number; currency: string; precision: number | string }) => {
        captureEvent(AnalyticsEvents.adRevenueGenerated, { ...properties, ...event });
      },
    );
    const earnedUnsub = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward: RewardedAdReward) => {
        earnedReward = reward;
        if (__DEV__) console.log('[ads:rewarded:earned]', { ...properties, adReward: reward });
        captureEvent(AnalyticsEvents.rewardedAdEarned, {
          ...properties,
          adRewardType: reward.type,
          adRewardAmount: reward.amount,
        });
        captureEvent(AnalyticsEvents.rewardedAdCompleted, properties);
      },
    );
    const closedUnsub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (settled) return;
      settled = true;
      const result: RewardedAdResult = earnedReward
        ? { status: 'completed', adReward: earnedReward }
        : { status: 'cancelled' };
      captureEvent(AnalyticsEvents.rewardedAdClosed, { ...properties, rewardEarned: !!earnedReward });
      if (!earnedReward) captureEvent(AnalyticsEvents.rewardedAdCancelled, properties);
      if (__DEV__) console.log('[ads:rewarded:closed]', { ...properties, rewardEarned: !!earnedReward });
      cleanup();
      resolve(result);
    });

    try {
      if (__DEV__) console.log('[ads:rewarded:load]', { ...properties, unitId: AdMobConfig.rewardedAdUnitId });
      ad.load();
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Failed to load rewarded ad.'));
    }
  });
}
