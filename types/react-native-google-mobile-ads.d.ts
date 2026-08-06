// Project-level type declarations for react-native-google-mobile-ads.
// The published v16.4.0 package contains corrupted .d.ts files (null bytes).
// This file provides the types our codebase actually uses until upstream is fixed.

declare module 'react-native-google-mobile-ads' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  // ─── Test IDs ───────────────────────────────────────────────────────────
  export enum TestIds {
    BANNER = 'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712',
    INTERSTITIAL_VIDEO = 'ca-app-pub-3940256099942544/8691691433',
    REWARDED = 'ca-app-pub-3940256099942544/5224354917',
    REWARDED_INTERSTITIAL = 'ca-app-pub-3940256099942544/5354046379',
    NATIVE_ADVANCED = 'ca-app-pub-3940256099942544/2247696110',
    NATIVE_ADVANCED_VIDEO = 'ca-app-pub-3940256099942544/1044960115',
    APP_OPEN = 'ca-app-pub-3940256099942544/3419835294',
  }

  // ─── Banner ─────────────────────────────────────────────────────────────
  export enum BannerAdSize {
    BANNER = 'BANNER',
    LARGE_BANNER = 'LARGE_BANNER',
    MEDIUM_RECTANGLE = 'MEDIUM_RECTANGLE',
    FULL_BANNER = 'FULL_BANNER',
    LEADERBOARD = 'LEADERBOARD',
    ADAPTIVE_BANNER = 'ADAPTIVE_BANNER',
    ANCHORED_ADAPTIVE_BANNER = 'ANCHORED_ADAPTIVE_BANNER',
    INLINE_ADAPTIVE_BANNER = 'INLINE_ADAPTIVE_BANNER',
    FLUID = 'FLUID',
    WIDE_SKYSCRAPER = 'WIDE_SKYSCRAPER',
  }

  export interface BannerAdProps {
    unitId: string;
    size: BannerAdSize | string;
    requestOptions?: RequestOptions;
    onAdLoaded?: () => void;
    onAdFailedToLoad?: (error: { message: string; code: string | number }) => void;
    onAdOpened?: () => void;
    onAdClosed?: () => void;
    onPaid?: (event: { value: number; currency: string; precision: number }) => void;
    style?: ViewStyle;
  }

  export class BannerAd extends Component<BannerAdProps> {}

  // ─── Rewarded Ad ────────────────────────────────────────────────────────
  export interface RewardedAdReward {
    type: string;
    amount: number;
  }

  export enum RewardedAdEventType {
    LOADED = 'loaded',
    EARNED_REWARD = 'earned_reward',
  }

  export enum AdEventType {
    ERROR = 'error',
    OPENED = 'opened',
    CLOSED = 'closed',
    PAID = 'paid',
  }

  export interface AdShowOptions {
    immersiveModeEnabled?: boolean;
  }

  export class RewardedAd {
    static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions): RewardedAd;

    addAdEventListener(
      type: RewardedAdEventType | AdEventType | string,
      listener: (event?: any) => void,
    ): () => void;

    load(): Promise<void>;
    show(showOptions?: AdShowOptions): Promise<void>;
  }

  // ─── Mobile Ads ─────────────────────────────────────────────────────────
  export interface MobileAdsModule {
    initialize(): Promise<{ adapterStatuses: AdapterStatus[] }>;
    setRequestConfiguration(requestConfiguration: RequestConfiguration): Promise<void>;
    openAdInspector(): Promise<void>;
    openDebugMenu(adUnitId: string): Promise<void>;
  }

  export function mobileAds(): MobileAdsModule;

  export interface AdapterStatus {
    name: string;
    description: string;
    latency: number;
    state: 'READY' | 'NOT_READY';
  }

  export interface RequestConfiguration {
    maxAdContentRating?: 'G' | 'MA' | 'PG' | 'T' | 'UNSPECIFIED';
    tagForChildDirectedTreatment?: boolean | null;
    tagForUnderAgeOfConsent?: boolean | null;
    testDeviceIdentifiers?: string[];
  }

  export interface RequestOptions {
    requestNonPersonalizedAdsOnly?: boolean;
    networkExtras?: Record<string, string>;
    keywords?: string[];
    testDeviceIdentifiers?: string[];
  }

  // ─── UMP Consent ────────────────────────────────────────────────────────
  export enum AdsConsentStatus {
    UNKNOWN = 'UNKNOWN',
    REQUIRED = 'REQUIRED',
    NOT_REQUIRED = 'NOT_REQUIRED',
    OBTAINED = 'OBTAINED',
  }

  export interface AdsConsentInfo {
    status: AdsConsentStatus;
    canRequestAds: boolean;
    isConsentFormAvailable: boolean;
  }

  export interface AdsConsentFormOptions {
    privacyPolicyUrl?: string;
  }

  export class AdsConsent {
    static requestInfoUpdate(options?: AdsConsentFormOptions): Promise<AdsConsentInfo>;
    static showForm(options?: AdsConsentFormOptions): Promise<AdsConsentInfo>;
    static getStatus(): Promise<AdsConsentStatus>;
    static getUserChoices(): Promise<Record<string, boolean>>;
    static reset(): Promise<void>;
  }
}
