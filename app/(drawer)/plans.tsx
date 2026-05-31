import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppPromptModal, RequireAuthRoute, SecondaryNav } from '@/components';
import {
  createBillingPortalSession,
  createCheckoutSession,
  getDailyUsage,
  getSubscriptionOverview,
  getSubscriptionPlans,
  syncSubscriptionState,
} from '@/features';
import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { purchasePackage } from '@/services/revenuecat/purchases';
import { getRevenueCatAppUserId, identifyUser, openIosSubscriptionManagement } from '@/services/revenuecat';
import { getActiveExpirationDate, resolveRCTier } from '@/services/revenuecat/entitlements';
import { clearPendingBillingTier, setPendingBillingTier } from '@/services';
import type { SubscriptionOverview, SubscriptionPlan, SubscriptionTier, UsageSnapshot } from '@/types';

function tierLabel(tier?: SubscriptionTier) {
  switch (tier) {
    case 'cafa_smart':
      return 'Cafa Smart';
    case 'cafa_pro':
      return 'Cafa Pro';
    case 'cafa_max':
      return 'Cafa Max';
    default:
      return 'Free';
  }
}

function cleanPlanTitle(title: string | undefined | null, fallbackTier: SubscriptionTier) {
  const raw = (title ?? '').trim();
  if (!raw) return tierLabel(fallbackTier);
  return raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*subscription\s*$/i, '')
    .trim();
}

function normalizeBenefits(value: unknown): string[] {
  const normalizeLine = (line: string) => line.replace(/^[\s\-*\u2022]+/, '').trim();
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(/\r?\n/) : []))
      .map((item) => normalizeLine(item))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|[,;](?=\s*[A-Za-z0-9])/)
      .map((item) => normalizeLine(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeDescription(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  cafa_smart: 1,
  cafa_pro: 2,
  cafa_max: 3,
};
function formatLimit(limit?: number | null) {
  if (typeof limit !== 'number') return 'N/A';
  if (limit < 0) return '\u221e';
  return `${limit}`;
}

function isUnlimitedLimit(limit?: number | null) {
  return typeof limit === 'number' && limit < 0;
}

function formatUsageWindow(bucketDate?: string | null) {
  if (!bucketDate || !/^\d{4}-\d{2}$/.test(bucketDate)) return 'Monthly';
  const [year, month] = bucketDate.split('-').map((v) => Number(v));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 'Monthly';
  return 'Monthly';
}

function getLimitState(used: number, limit?: number | null) {
  if (typeof limit !== 'number') return { percent: 0, nearLimit: false, reached: false };
  if (isUnlimitedLimit(limit)) return { percent: 0, nearLimit: false, reached: false };
  if (limit <= 0) return { percent: 100, nearLimit: true, reached: true };
  const ratio = used / limit;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return {
    percent,
    nearLimit: ratio >= 0.8,
    reached: ratio >= 1,
  };
}


function toCafaChatModelLabel(model?: string | null) {
  const normalized = (model ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'gpt-4o') return 'Cafa Ultra';
  if (normalized === 'gpt-4o-mini') return 'Cafa Smart';
  return 'Cafa Smart';
}

function isBillingSuccessUrl(url: string, appScheme: string) {
  return (
    url.startsWith(`${appScheme}://billing/success`) ||
    url.startsWith(`${appScheme}:///billing/success`)
  );
}

function isBillingCancelUrl(url: string, appScheme: string) {
  return (
    url.startsWith(`${appScheme}://billing/cancel`) ||
    url.startsWith(`${appScheme}:///billing/cancel`)
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeExternalHttpUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/\/(undefined|null)(?:[/?#]|$)/i.test(trimmed)) return null;
  return trimmed;
}

function createBillingTraceId(scope: string) {
  return `mobile-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPaymentHealthyStatus(status?: string | null) {
  return status === 'active' || status === 'trialing';
}

function isPaymentProblemStatus(status?: string | null) {
  return status === 'past_due' || status === 'failed' || status === 'incomplete' || status === 'unpaid';
}

function resolveOverviewUsageCount(
  usage: SubscriptionOverview['usage'] | Record<string, unknown> | undefined,
  key: 'chat' | 'images' | 'videos',
) {
  if (!usage || typeof usage !== 'object') return null;

  const record = usage as Record<string, unknown>;
  const direct =
    key === 'chat'
      ? asNumber(record.chatMessagesThisMonth) ?? asNumber(record.chatMessagesToday)
      : key === 'images'
        ? asNumber(record.imageGenerationsThisMonth) ?? asNumber(record.imageGenerationsToday)
        : asNumber(record.videoGenerationsThisMonth) ?? asNumber(record.videoGenerationsToday);
  if (direct != null) return direct;

  const nested = key === 'chat' ? record.chat : key === 'images' ? record.images : record.videos;
  if (nested && typeof nested === 'object') {
    return asNumber((nested as Record<string, unknown>).used);
  }
  return null;
}

function normalizeUsageAndLimits(
  overview: SubscriptionOverview | null,
  usageSnapshot: UsageSnapshot | null,
  currentPlan?: SubscriptionPlan,
) {
  const limits = overview?.limits ?? currentPlan?.limits;
  const usage = overview?.usage;
  const chatUsedFromOverview = resolveOverviewUsageCount(usage, 'chat');
  const imageUsedFromOverview = resolveOverviewUsageCount(usage, 'images');
  const videoUsedFromOverview = resolveOverviewUsageCount(usage, 'videos');

  return {
    usageBucketDate: usageSnapshot?.bucketDate ?? null,
    chatUsed: chatUsedFromOverview ?? usageSnapshot?.chatUsed ?? 0,
    chatLimit: usageSnapshot?.chatLimit ?? limits?.chatMessagesPerDay ?? 500,
    imageUsed: imageUsedFromOverview ?? usageSnapshot?.imageUsed ?? 0,
    imageLimit: usageSnapshot?.imageLimit ?? limits?.imageGenerationsPerDay ?? 5,
    videoUsed: videoUsedFromOverview ?? usageSnapshot?.videoUsed ?? 0,
    videoLimit: usageSnapshot?.videoLimit ?? limits?.videoGenerationsPerDay ?? 1,
    maxUploadSizeMB: usageSnapshot?.maxUploadSizeMB ?? null,
    maxPdfPages: usageSnapshot?.maxPdfPages ?? null,
    maxDocxPages: usageSnapshot?.maxDocxPages ?? null,
    maxPptxSlides: usageSnapshot?.maxPptxSlides ?? null,
    docAnalysesUsed: usageSnapshot?.docAnalysesUsed ?? 0,
    docAnalysesPerMonth: usageSnapshot?.docAnalysesPerMonth ?? null,
    exportsUsed: usageSnapshot?.exportsUsed ?? 0,
    exportsPerMonth: usageSnapshot?.exportsPerMonth ?? null,
    maxVideoDurationSeconds: limits?.maxVideoDurationSeconds ?? 3,
    contextMessages: limits?.contextMessages ?? null,
    maxTokensPerRequest: limits?.maxTokensPerRequest ?? null,
    documentsEnabled: typeof limits?.documentsEnabled === 'boolean' ? limits.documentsEnabled : null,
    chatModelLabel: toCafaChatModelLabel(limits?.chatModel),
  };
}

export default function PlansScreen() {
  const { authUser, setAuthSubscriptionTier, refreshAuthUser } = useAppContext();
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { activeTier, offering, refreshCustomerInfo, refreshOffering, restorePurchases } = useRevenueCat();
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<SubscriptionTier | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [dailyUsage, setDailyUsage] = useState<UsageSnapshot | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [statusText, setStatusText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChangePlanPrompt, setShowChangePlanPrompt] = useState(false);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [showPlanUpdatedPrompt, setShowPlanUpdatedPrompt] = useState(false);
  const [updatedTier, setUpdatedTier] = useState<SubscriptionTier | null>(null);
  const [isRefreshingOfferings, setIsRefreshingOfferings] = useState(false);
  const appScheme = ((Constants.expoConfig as { scheme?: string } | undefined)?.scheme || 'cafa-ai').replace('://', '');
  const appStateRef = useRef(AppState.currentState);
  const lastSyncAtRef = useRef(0);
  const syncInFlightRef = useRef<Promise<Awaited<ReturnType<typeof syncSubscriptionState>> | null> | null>(null);
  const portalFlowActiveRef = useRef(false);
  const latestSubscriptionRef = useRef<{ tier: SubscriptionTier; status: string } | null>(null);
  const plansDebug = useCallback((_event: string, _payload?: Record<string, unknown>) => {}, []);

  const toErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Unknown request error.';
  };

  const loadBillingData = useCallback(async (options?: { force?: boolean }) => {
    try {
      plansDebug('loadBillingData:start', {
        force: Boolean(options?.force),
      });
      const [nextOverview, nextPlansPayload, nextDailyUsage] = await Promise.all([
        getSubscriptionOverview({ force: options?.force }),
        getSubscriptionPlans({ force: options?.force }),
        getDailyUsage({ force: options?.force }),
      ]);
      plansDebug('loadBillingData:resolved', {
        overviewTier: nextOverview.subscription.tier,
        overviewStatus: nextOverview.subscription.status,
        planCount: nextPlansPayload.plans?.length ?? 0,
        chatUsed: nextDailyUsage.chatUsed ?? null,
      });
      setOverview(nextOverview);
      latestSubscriptionRef.current = {
        tier: nextOverview.subscription.tier,
        status: nextOverview.subscription.status,
      };
      setPlans(nextPlansPayload.plans ?? []);
      setDailyUsage(nextDailyUsage);
      return nextOverview;
    } catch (error) {
      throw error;
    }
  }, [plansDebug]);

  const syncSubscriptionAndApplyTier = useCallback(async (options?: { force?: boolean; traceId?: string; reason?: string }) => {
    const now = Date.now();
    const minIntervalMs = 8_000;
    if (!options?.force && now - lastSyncAtRef.current < minIntervalMs) {
      plansDebug('syncEndpoint:skipped', { reason: 'throttled' });
      return null;
    }
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    syncInFlightRef.current = (async () => {
      try {
        lastSyncAtRef.current = Date.now();
        const synced = await syncSubscriptionState({
          traceId: options?.traceId,
          reason: options?.reason ?? (options?.force ? 'plans-force-sync' : 'plans-sync'),
        });
        setAuthSubscriptionTier(synced.tier);
        plansDebug('syncEndpoint:resolved', {
          tier: synced.tier,
          status: synced.status,
          scheduledTier: synced.scheduledTier,
          scheduledChangeAt: synced.scheduledChangeAt,
        });
        return synced;
      } catch (error) {
        const typed = error as { status?: number; code?: string; message?: string } | undefined;
        const message = typed?.message ?? (error instanceof Error ? error.message : 'unknown');
        if (typed?.status === 429 || typed?.code === 'RATE_LIMIT_EXCEEDED') {
          plansDebug('syncEndpoint:rate-limited', { status: typed?.status ?? null, code: typed?.code ?? null, message });
          return null;
        }
        throw error;
      } finally {
        syncInFlightRef.current = null;
      }
    })();

    return syncInFlightRef.current;
  }, [plansDebug, setAuthSubscriptionTier]);

  const syncSubscriptionAfterCheckout = useCallback((
    requestedTier: SubscriptionTier,
    baseline?: { tier: SubscriptionTier; status: string } | null,
    traceId?: string,
  ) => {
    plansDebug('syncAfterCheckout:start', {
      requestedTier,
      baselineTier: baseline?.tier ?? null,
      baselineStatus: baseline?.status ?? null,
      traceId: traceId ?? null,
    });
    const timeoutAt = Date.now() + 60_000;
    let attempt = 0;
    const run = async () => {
      while (Date.now() < timeoutAt) {
        try {
          if (attempt === 0 || attempt % 3 === 0) {
            await syncSubscriptionAndApplyTier({
              force: true,
              traceId,
              reason: 'post-checkout-poll',
            }).catch(() => null);
          }
          const latest = await getSubscriptionOverview({ force: true });
          setOverview(latest);
          latestSubscriptionRef.current = {
            tier: latest.subscription.tier,
            status: latest.subscription.status,
          };
          plansDebug('syncAfterCheckout:poll', {
            attempt,
            latestTier: latest.subscription.tier,
            latestStatus: latest.subscription.status,
            scheduledTier: latest.scheduledTier ?? null,
            scheduledChangeAt: latest.scheduledChangeAt ?? null,
          });
          if (latest.subscription.tier === requestedTier && isPaymentHealthyStatus(latest.subscription.status)) {
            const hadEntitlementChange = !baseline || baseline.tier !== requestedTier || !isPaymentHealthyStatus(baseline.status);
            setStatusText(
              hadEntitlementChange
                ? t('plans.upgradeVerified', { plan: tierLabel(requestedTier) })
                : t('plans.alreadySubscribed'),
            );
            await loadBillingData({ force: true });
            await refreshAuthUser().catch(() => {});
            return;
          }

          const scheduledTier = latest.scheduledTier ?? null;
          const scheduledChangeAt = latest.scheduledChangeAt ?? null;
          if (scheduledTier && scheduledTier === requestedTier && latest.subscription.tier !== requestedTier) {
            const when = scheduledChangeAt ? new Date(scheduledChangeAt).toLocaleDateString() : 'the next billing cycle';
            setStatusText(`Plan change to ${tierLabel(requestedTier)} is scheduled for ${when}.`);
            await loadBillingData({ force: true });
            await refreshAuthUser().catch(() => {});
            return;
          }

          if (isPaymentProblemStatus(latest.subscription.status)) {
            setStatusText('Payment is pending or failed. Please update your payment method in the billing portal.');
            await loadBillingData({ force: true });
            await refreshAuthUser().catch(() => {});
            return;
          }
        } catch {
          // keep polling until timeout
        }
        const pollDelayMs = attempt < 4 ? 5_000 : 8_000;
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
      }
      setStatusText(t('plans.upgradeSyncPending'));
      plansDebug('syncAfterCheckout:timeout', { requestedTier });
    };

    return run();
  }, [loadBillingData, plansDebug, refreshAuthUser, syncSubscriptionAndApplyTier, t]);

  const syncSubscriptionAfterPortalReturn = useCallback(async () => {
    const previous = latestSubscriptionRef.current;
    plansDebug('syncAfterPortal:start', {
      previousTier: previous?.tier ?? null,
      previousStatus: previous?.status ?? null,
    });
    const timeoutAt = Date.now() + 24_000;
    let latestOverview: SubscriptionOverview | null = null;
    let hadError = false;

    while (Date.now() < timeoutAt) {
      try {
        latestOverview = await loadBillingData({ force: true });
        plansDebug('syncAfterPortal:poll', {
          latestTier: latestOverview.subscription.tier,
          latestStatus: latestOverview.subscription.status,
        });
        const changed =
          !previous ||
          previous.tier !== latestOverview.subscription.tier ||
          previous.status !== latestOverview.subscription.status;
        if (changed) {
          setStatusText(
            t('plans.portalSyncUpdated', {
              plan: tierLabel(latestOverview.subscription.tier),
              status: latestOverview.subscription.status,
            }),
          );
          await refreshAuthUser().catch(() => {});
          portalFlowActiveRef.current = false;
          return;
        }
      } catch (error) {
        hadError = true;
        void error;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }

    if (hadError && !latestOverview) {
      setStatusText(t('plans.portalSyncError'));
    } else {
      setStatusText(t('plans.portalSyncNoChange'));
    }
    portalFlowActiveRef.current = false;
    plansDebug('syncAfterPortal:end');
  }, [loadBillingData, plansDebug, refreshAuthUser, t]);

  useEffect(() => {
    if (!overview?.subscription.tier) return;
    plansDebug('overview:setAuthTier', {
      tier: overview.subscription.tier,
      status: overview.subscription.status,
    });
    setAuthSubscriptionTier(overview.subscription.tier);
  }, [overview?.subscription.status, overview?.subscription.tier, plansDebug, setAuthSubscriptionTier]);

  useFocusEffect(
    useCallback(() => {
      // Drawer screens can stay mounted; refresh only when this screen is visited.
      void (async () => {
        setLoading(true);
        setStatusText('');
        try {
          await syncSubscriptionAndApplyTier().catch(() => null);
          await loadBillingData();
        } catch (error) {
          setStatusText(toErrorMessage(error) || t('plans.loadError'));
        } finally {
          setLoading(false);
        }
      })().catch(() => {});
      return () => {};
    }, [loadBillingData, syncSubscriptionAndApplyTier, t]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;
      if (state !== 'active') return;
      if (portalFlowActiveRef.current) {
        void syncSubscriptionAfterPortalReturn();
      }
    });
    return () => sub.remove();
  }, [syncSubscriptionAfterPortalReturn]);

  const onPullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setStatusText('');
    try {
      await syncSubscriptionAndApplyTier({ force: true }).catch(() => null);
      await loadBillingData({ force: true });
    } catch (error) {
      setStatusText(toErrorMessage(error) || t('plans.loadError'));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBillingData, syncSubscriptionAndApplyTier, t]);

  const currentTier = Platform.OS === 'ios' ? activeTier : (overview?.subscription.tier ?? 'free');
  const subscriptionLifecycle = overview?.subscriptionLifecycle;

  const displayPlans = useMemo(() => {
    if (Platform.OS === 'ios') {
      const backendPlanByTier = new Map(plans.map((plan) => [plan.tier, plan] as const));
      const moveFreePlanToEnd = (inputPlans: SubscriptionPlan[]) => {
        const nonFreePlans = inputPlans.filter((plan) => plan.tier !== 'free');
        const freePlans = inputPlans.filter((plan) => plan.tier === 'free');
        return [...nonFreePlans, ...freePlans];
      };
      if (!offering) {
        // Keep plan details visible for App Review, but disable purchasing until RC products load.
        return moveFreePlanToEnd(
          plans.map((plan) => ({ ...plan, benefits: normalizeBenefits(plan.benefits), isActive: false })),
        );
      }
      const packages = Array.isArray(offering.availablePackages) ? offering.availablePackages : [];
      const paidPlans = packages
        .filter((pkg) => pkg?.product != null)
        .map((pkg): SubscriptionPlan & { _rcPackage: any } => {
          const productTitle = typeof pkg.product.title === 'string' ? pkg.product.title : '';
          const titleWords = productTitle.toLowerCase();
          const identifier = typeof pkg.identifier === 'string' ? pkg.identifier.toLowerCase() : '';
          let tier: SubscriptionTier = 'free';
          if (identifier.includes('max') || titleWords.includes('max')) tier = 'cafa_max';
          else if (identifier.includes('pro') || titleWords.includes('pro')) tier = 'cafa_pro';
          else if (identifier.includes('smart') || titleWords.includes('smart')) tier = 'cafa_smart';
          const backendPlan = backendPlanByTier.get(tier);
          const normalizedPrice = Number(pkg.product.price);
          const safeAmount = Number.isFinite(normalizedPrice) ? Number(normalizedPrice.toFixed(2)) : 0;
          const safeInterval = pkg.product.subscriptionPeriod === 'P1Y' ? 'yr' : 'mo';

          return {
            tier,
            name: cleanPlanTitle(productTitle, tier),
            // Keep Android/backend copy parity for richer plan details.
            description: normalizeDescription(backendPlan?.description) || normalizeDescription(pkg.product.description),
            benefits: normalizeBenefits(backendPlan?.benefits),
            isActive: true,
            price: {
              amount: safeAmount,
              currency: typeof pkg.product.currencyCode === 'string' ? pkg.product.currencyCode : 'USD',
              interval: safeInterval,
            },
            _rcPackage: pkg,
          };
        }).filter((p) => p.tier !== 'free');

      const freeBackendPlan = backendPlanByTier.get('free');
      const freePlan: SubscriptionPlan = {
        tier: 'free',
        name: cleanPlanTitle(freeBackendPlan?.name, 'free'),
        description: normalizeDescription(freeBackendPlan?.description),
        benefits: normalizeBenefits(freeBackendPlan?.benefits),
        isActive: true,
        price: {
          amount: 0,
          currency: 'USD',
          interval: 'mo',
        },
        limits: freeBackendPlan?.limits,
      };

      return [...paidPlans, freePlan];
    }
    return plans.map((plan) => ({
      ...plan,
      description: normalizeDescription(plan.description),
      benefits: normalizeBenefits(plan.benefits),
    }));
  }, [offering, plans]);

  const currentPlan = useMemo(
    () => displayPlans.find((plan) => plan.tier === currentTier),
    [currentTier, displayPlans],
  );
  const stats = normalizeUsageAndLimits(overview, dailyUsage, currentPlan);
  const usagePeriodLabel = formatUsageWindow(stats.usageBucketDate);
  const chatLimitState = getLimitState(stats.chatUsed, stats.chatLimit);
  const imageLimitState = getLimitState(stats.imageUsed, stats.imageLimit);
  const videoLimitState = getLimitState(stats.videoUsed, stats.videoLimit);
  const docAnalysesLimitState = getLimitState(stats.docAnalysesUsed, stats.docAnalysesPerMonth);
  const exportsLimitState = getLimitState(stats.exportsUsed, stats.exportsPerMonth);
  const openCheckoutUrl = async (
    rawUrl: string,
    mode: 'checkout' | 'portal' = 'checkout',
    returnStrategy: 'redirect_to_app' | 'redirect_to_web' | string = 'redirect_to_web',
    expectedSuccessUrl?: string,
    expectedCancelUrl?: string,
  ) => {
    const url = sanitizeExternalHttpUrl(rawUrl);
    if (!url) {
      throw new Error('Checkout URL is invalid.');
    }

    if (mode === 'checkout' && Platform.OS === 'ios' && returnStrategy === 'redirect_to_app') {
      try {
        const redirectUri = `${appScheme}://billing`;
        const authResult = await WebBrowser.openAuthSessionAsync(url, redirectUri);
        if (authResult.type === 'success' && authResult.url) {
          const expectedSuccessPrefix = expectedSuccessUrl
            ? expectedSuccessUrl.replace('?session_id={CHECKOUT_SESSION_ID}', '')
            : null;
          if (expectedSuccessPrefix && authResult.url.startsWith(expectedSuccessPrefix)) {
            router.replace('/billing/success');
            return;
          }
          if (expectedCancelUrl && authResult.url.startsWith(expectedCancelUrl)) {
            router.replace('/billing/cancel');
            return;
          }
          if (isBillingSuccessUrl(authResult.url, appScheme)) {
            router.replace('/billing/success');
            return;
          }
          if (isBillingCancelUrl(authResult.url, appScheme)) {
            router.replace('/billing/cancel');
            return;
          }
        }
      } catch {
        // fallback below
      }
    }

    try {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: colors.primary,
        showInRecents: true,
      });
      return;
    } catch {
      // Fallback below.
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error('Could not open Stripe checkout URL.');
    }
    await Linking.openURL(url);
  };

  const onUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    const traceId = createBillingTraceId(`upgrade-${tier}`);
    console.log(`[billing:trace] flow=upgrade tier=${tier} traceId=${traceId}`);
    setBusyTier(tier);
    setStatusText('');
    const baselineSubscription = latestSubscriptionRef.current ?? {
      tier: currentTier,
      status: overview?.subscription.status ?? 'inactive',
    };

    try {
      await setPendingBillingTier(tier);
      const checkout = await createCheckoutSession(tier, {
        platform: 'mobile',
        traceId,
      });
      const checkoutMode = (checkout as { mode?: string }).mode;
      const resolvedSuccessUrl = sanitizeExternalHttpUrl(checkout.successUrl);
      const resolvedCancelUrl = sanitizeExternalHttpUrl(checkout.cancelUrl);
      const resolvedCheckoutUrl = sanitizeExternalHttpUrl(checkout.url);
      const returnStrategy = (checkout as { returnStrategy?: string }).returnStrategy ?? 'redirect_to_web';

      if (checkoutMode === 'subscription_updated') {
        await clearPendingBillingTier();
        setStatusText('Syncing subscription status...');
        await syncSubscriptionAfterCheckout(tier, baselineSubscription, traceId);
        return;
      }

      if (checkoutMode === 'checkout_started' && !resolvedCheckoutUrl) {
        throw new Error('Checkout session started but no valid checkout URL was returned.');
      }

      if (checkoutMode === 'checkout_started' && resolvedCheckoutUrl) {
        await openCheckoutUrl(resolvedCheckoutUrl, 'checkout', returnStrategy, resolvedSuccessUrl ?? undefined, resolvedCancelUrl ?? undefined);
        setStatusText('Processing payment...');
        await syncSubscriptionAfterCheckout(tier, baselineSubscription, traceId);
      } else {
        await clearPendingBillingTier();
        if (resolvedCheckoutUrl) {
          await openCheckoutUrl(resolvedCheckoutUrl, 'checkout', returnStrategy, resolvedSuccessUrl ?? undefined, resolvedCancelUrl ?? undefined);
          setStatusText('Processing payment...');
        } else {
          setStatusText('Syncing subscription status...');
        }
        await syncSubscriptionAfterCheckout(tier, baselineSubscription, traceId);
      }
    } catch (error) {
      const typedError = error as { message?: string; code?: string; status?: number; redirectUrl?: string } | undefined;
      const rawMessage = error instanceof Error ? error.message : t('plans.checkoutError');
      const safeRedirectUrl = sanitizeExternalHttpUrl(typedError?.redirectUrl);
      if (typedError?.code === 'MANAGE_EXISTING_SUBSCRIPTION' && safeRedirectUrl) {
        try {
          await clearPendingBillingTier();
          await openCheckoutUrl(safeRedirectUrl, 'portal');
          setStatusText(t('plans.redirectingToPortalForUpgrade'));
        } catch (portalError) {
          const portalMessage = portalError instanceof Error ? portalError.message : t('plans.portalError');
          setStatusText(portalMessage);
        } finally {
          setBusyTier(null);
        }
        return;
      }
      const isAlreadySubscribed = typedError?.code === 'ALREADY_SUBSCRIBED';
      const message = isAlreadySubscribed ? t('plans.alreadySubscribed') : rawMessage;
      await clearPendingBillingTier();
      setStatusText(
        message,
      );
    } finally {
      setBusyTier(null);
    }
  };

  const requestUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free' || tier === currentTier) return;

    if (Platform.OS === 'ios') {
      if (!authUser?.id) {
        setStatusText('Please sign in again before purchasing.');
        return;
      }
      try {
        await identifyUser(authUser.id);
        const rcAppUserId = await getRevenueCatAppUserId();
        plansDebug('purchaseIdentity:check', {
          expectedAppUserId: authUser.id,
          rcAppUserId,
        });
        if (!rcAppUserId || rcAppUserId.startsWith('$RCAnonymousID:')) {
          setStatusText('Subscription identity is still syncing. Please wait a few seconds and try again.');
          return;
        }
      } catch (identityError) {
        const message = identityError instanceof Error ? identityError.message : 'Failed to validate purchase identity.';
        setStatusText(message);
        return;
      }

          const targetPlan = displayPlans.find((p) => p.tier === tier) as any;
      if (!targetPlan?._rcPackage) return;

      setBusyTier(tier);
      setStatusText('');
      plansDebug('requestUpgrade:ios:start', {
        requestedTier: tier,
        currentTier,
        hasPackage: Boolean(targetPlan?._rcPackage),
        packageId: targetPlan?._rcPackage?.identifier ?? null,
      });
      try {
        const customerInfo = await purchasePackage(targetPlan._rcPackage);
        const resolvedTier = resolveRCTier(customerInfo);
        plansDebug('requestUpgrade:ios:purchaseResult', {
          resolvedTier,
          activeEntitlements: Object.keys(customerInfo?.entitlements?.active ?? {}),
          activeSubscriptions: customerInfo?.activeSubscriptions ?? [],
          allPurchasedProductIdentifiers: (customerInfo as { allPurchasedProductIdentifiers?: string[] } | undefined)?.allPurchasedProductIdentifiers ?? [],
        });
        const requestedDowngrade = TIER_RANK[tier] < TIER_RANK[currentTier];
        const syncedAfterPurchase = await syncSubscriptionAndApplyTier({ force: true }).catch(() => null);
        const effectiveTier = syncedAfterPurchase?.tier ?? resolvedTier;
        const didResolveToRequestedTier = effectiveTier === tier;
        const downgradeScheduled = requestedDowngrade && TIER_RANK[resolvedTier] > TIER_RANK[tier];
        const effectiveDate = getActiveExpirationDate(customerInfo);
        await refreshCustomerInfo();
        await syncSubscriptionAndApplyTier().catch(() => null);
        if (resolvedTier !== 'free') {
          setAuthSubscriptionTier(effectiveTier);
        }
        await refreshAuthUser().catch(() => {});
        void syncSubscriptionAfterCheckout(tier, latestSubscriptionRef.current);

        // Defensive recovery: if purchase completed but entitlement is not visible yet,
        // force a restore to reconcile App Store receipt ownership for this app user.
        if (resolvedTier === 'free') {
          setStatusText(t('plans.syncingSubscription'));
          plansDebug('requestUpgrade:ios:free-after-purchase:restoring');
          try {
            await restorePurchases();
            await refreshCustomerInfo();
            await syncSubscriptionAndApplyTier().catch(() => null);
            await loadBillingData({ force: true });
            void syncSubscriptionAfterCheckout(tier, latestSubscriptionRef.current);
          } catch {
            // Keep the syncing state message; user can retry restore from the CTA.
          }
          return;
        }

        if (downgradeScheduled) {
          setStatusText(
            t('plans.downgradeScheduled', {
              plan: tierLabel(tier),
              date: effectiveDate ? effectiveDate.toLocaleDateString() : 'the next renewal date',
            }),
          );
        } else if (!didResolveToRequestedTier) {
          // Apple may defer plan changes to the next billing cycle depending on
          // subscription group level/duration rules.
          const when = effectiveDate ? effectiveDate.toLocaleDateString() : 'the next renewal date';
          if (TIER_RANK[tier] > TIER_RANK[effectiveTier]) {
            setStatusText(`Purchase recorded. ${tierLabel(tier)} may take effect on ${when}. Current active plan is ${tierLabel(effectiveTier)}.`);
          } else {
            setStatusText(`Plan change is pending until ${when}. Current active plan is ${tierLabel(effectiveTier)}.`);
          }
        } else {
          setStatusText(t('plans.planUpdatedInPlace', { plan: tierLabel(tier) }));
          setUpdatedTier(tier);
          setShowPlanUpdatedPrompt(true);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : t('plans.checkoutError');
        plansDebug('requestUpgrade:ios:error', { requestedTier: tier, error: errorMsg });
        const lower = errorMsg.toLowerCase();
        const isAlreadyOwnedError =
          lower.includes('already')
          || lower.includes('subscribed')
          || lower.includes('owned')
          || lower.includes('purchase is already');
        if (isAlreadyOwnedError) {
          setStatusText(t('plans.syncingSubscription'));
          plansDebug('requestUpgrade:ios:already-owned:restore-flow', { requestedTier: tier });
          try {
            await restorePurchases();
            await refreshCustomerInfo();
            await syncSubscriptionAndApplyTier().catch(() => null);
            await loadBillingData({ force: true });
            await refreshAuthUser().catch(() => {});
            void syncSubscriptionAfterCheckout(tier, latestSubscriptionRef.current);
          } catch (restoreError) {
            const restoreMessage = restoreError instanceof Error ? restoreError.message : t('plans.portalError');
            setStatusText(restoreMessage);
          }
          return;
        }
        // if user cancelled, don't show an ugly error message
        if (!lower.includes('cancel')) {
          setStatusText(errorMsg);
        }
      } finally {
        setBusyTier(null);
      }
      return;
    }

    const hasExistingPaidPlan = currentTier !== 'free' && (overview?.subscription.status === 'active' || overview?.subscription.status === 'past_due');
    if (hasExistingPaidPlan) {
      setPendingTier(tier);
      setShowChangePlanPrompt(true);
      return;
    }
    void onUpgrade(tier);
  };

  const onOpenBillingPortal = async () => {
    const traceId = createBillingTraceId('portal');
    console.log(`[billing:trace] flow=portal traceId=${traceId}`);
    setIsPortalLoading(true);
    setStatusText('');
    plansDebug('portal:open:start');
    try {
      const returnUrl = `${appScheme}://billing/return`;
      const portal = await createBillingPortalSession({
        platform: 'mobile',
        returnUrl,
        traceId,
      });
      portalFlowActiveRef.current = true;
      await openCheckoutUrl(portal.url, 'portal');
      if (portalFlowActiveRef.current) {
        await syncSubscriptionAfterPortalReturn();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('plans.portalError');
      setStatusText(message);
    } finally {
      setIsPortalLoading(false);
      plansDebug('portal:open:end');
    }
  };

  const retryLoadIosPlans = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    setIsRefreshingOfferings(true);
    setStatusText('');
    try {
      const nextOffering = await refreshOffering();
      if (!nextOffering) {
        setStatusText('Subscription plans are still unavailable. Please try again in a moment.');
      }
    } finally {
      setIsRefreshingOfferings(false);
    }
  }, [refreshOffering]);

  const onOpenIosSubscriptionManagement = async () => {
    if (Platform.OS !== 'ios') return;
    setIsCancelLoading(true);
    setStatusText('');
    plansDebug('iosSubscriptionManagement:open:start');
    try {
      await openIosSubscriptionManagement();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('plans.portalError'));
    } finally {
      setIsCancelLoading(false);
      plansDebug('iosSubscriptionManagement:open:end');
    }
  };

  useEffect(() => {
    plansDebug('snapshot', {
      platform: Platform.OS,
      activeTier,
      currentTier,
      overviewTier: overview?.subscription.tier ?? null,
      overviewStatus: overview?.subscription.status ?? null,
      offeringPackages: offering?.availablePackages?.map((pkg) => pkg.identifier) ?? [],
      displayPlanTiers: displayPlans.map((plan) => plan.tier),
      busyTier,
      statusText,
    });
  }, [
    activeTier,
    busyTier,
    currentTier,
    displayPlans,
    offering,
    overview?.subscription.status,
    overview?.subscription.tier,
    plansDebug,
    statusText,
  ]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <AppPromptModal
          visible={showChangePlanPrompt}
          title={t('plans.changePlanPromptTitle')}
          message={t('plans.changePlanPromptMessage', {
            currentPlan: tierLabel(currentTier),
            nextPlan: tierLabel(pendingTier ?? 'free'),
          })}
          confirmLabel={t('plans.changePlanPromptConfirm')}
          cancelLabel={t('common.cancel')}
          iconName="swap-horizontal-outline"
          onCancel={() => {
            setShowChangePlanPrompt(false);
            setPendingTier(null);
          }}
          onConfirm={() => {
            const target = pendingTier;
            setShowChangePlanPrompt(false);
            setPendingTier(null);
            if (target) {
              void onUpgrade(target);
            }
          }}
        />

        <AppPromptModal
          visible={showPlanUpdatedPrompt}
          title={t('plans.planUpdatedTitle')}
          message={t('plans.planUpdatedMessage', { plan: tierLabel(updatedTier ?? currentTier) })}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          iconName="checkmark-circle-outline"
          onCancel={() => {
            setShowPlanUpdatedPrompt(false);
            setUpdatedTier(null);
          }}
          onConfirm={() => {
            setShowPlanUpdatedPrompt(false);
            setUpdatedTier(null);
          }}
        />

        <SecondaryNav title={t('drawer.userMenu.upgrade')} topOffset={Math.max(insets.top, 0)} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void onPullToRefresh();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
        <View
          className="rounded-2xl border p-3"
          style={{
            borderColor: colors.border,
            backgroundColor: isDark ? '#0F0F12' : '#FFFFFF',
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
            {t('plans.currentSubscription')}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
            {tierLabel(currentTier)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {t('plans.subscriptionStatus')}: {Platform.OS === 'ios' ? (activeTier !== 'free' ? 'active' : 'inactive') : (overview?.subscription.status ?? 'inactive')}
          </Text>
          {subscriptionLifecycle?.willCancelAtPeriodEnd && subscriptionLifecycle.scheduledCancelAt ? (
            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              {t('plans.cancelsOn', { date: new Date(subscriptionLifecycle.scheduledCancelAt).toLocaleDateString() })}
            </Text>
          ) : null}
          {overview?.scheduledTier && overview.scheduledTier !== currentTier ? (
            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              {`Plan change to ${tierLabel(overview.scheduledTier)} is scheduled${
                overview.scheduledChangeAt ? ` for ${new Date(overview.scheduledChangeAt).toLocaleDateString()}` : ' for the next billing cycle'
              }.`}
            </Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
            Usage window: {usagePeriodLabel}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
            {t('plans.chatUsed')}: {stats.chatUsed} / {formatLimit(stats.chatLimit)} used this month
          </Text>
          {!isUnlimitedLimit(stats.chatLimit) ? (
            <View className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${chatLimitState.percent}%`, backgroundColor: chatLimitState.reached ? '#DC2626' : colors.primary }}
              />
            </View>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.imagesUsed')}: {stats.imageUsed} / {formatLimit(stats.imageLimit)} used this month
          </Text>
          {!isUnlimitedLimit(stats.imageLimit) ? (
            <View className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${imageLimitState.percent}%`, backgroundColor: imageLimitState.reached ? '#DC2626' : colors.primary }}
              />
            </View>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.videosUsed')}: {stats.videoUsed} / {formatLimit(stats.videoLimit)} used this month
          </Text>
          {!isUnlimitedLimit(stats.videoLimit) ? (
            <View className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${videoLimitState.percent}%`, backgroundColor: videoLimitState.reached ? '#DC2626' : colors.primary }}
              />
            </View>
          ) : null}
          {typeof stats.docAnalysesPerMonth === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              Doc analyses: {stats.docAnalysesUsed} / {formatLimit(stats.docAnalysesPerMonth)} this month
            </Text>
          ) : null}
          {typeof stats.docAnalysesPerMonth === 'number' && !isUnlimitedLimit(stats.docAnalysesPerMonth) ? (
            <View className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${docAnalysesLimitState.percent}%`, backgroundColor: docAnalysesLimitState.reached ? '#DC2626' : colors.primary }}
              />
            </View>
          ) : null}
          {typeof stats.exportsPerMonth === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              File exports: {stats.exportsUsed} / {formatLimit(stats.exportsPerMonth)} this month
            </Text>
          ) : null}
          {typeof stats.exportsPerMonth === 'number' && !isUnlimitedLimit(stats.exportsPerMonth) ? (
            <View className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${exportsLimitState.percent}%`, backgroundColor: exportsLimitState.reached ? '#DC2626' : colors.primary }}
              />
            </View>
          ) : null}
          {typeof stats.maxUploadSizeMB === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
              Max upload: {formatLimit(stats.maxUploadSizeMB)} MB
            </Text>
          ) : null}
          {typeof stats.maxPdfPages === 'number' || typeof stats.maxDocxPages === 'number' || typeof stats.maxPptxSlides === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {[
                typeof stats.maxPdfPages === 'number' ? `PDF pages: ${formatLimit(stats.maxPdfPages)}` : null,
                typeof stats.maxDocxPages === 'number' ? `DOCX pages: ${formatLimit(stats.maxDocxPages)}` : null,
                typeof stats.maxPptxSlides === 'number' ? `PPTX slides: ${formatLimit(stats.maxPptxSlides)}` : null,
              ].filter(Boolean).join(' | ')}
            </Text>
          ) : null}
          {chatLimitState.reached || imageLimitState.reached || videoLimitState.reached || docAnalysesLimitState.reached || exportsLimitState.reached ? (
            <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 8, fontWeight: '700' }}>
              One or more monthly limits reached. Some features are blocked until next month or plan upgrade.
            </Text>
          ) : null}
          {!(
            chatLimitState.reached || imageLimitState.reached || videoLimitState.reached || docAnalysesLimitState.reached || exportsLimitState.reached
          ) && (
            chatLimitState.nearLimit || imageLimitState.nearLimit || videoLimitState.nearLimit || docAnalysesLimitState.nearLimit || exportsLimitState.nearLimit
          ) ? (
            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 8, fontWeight: '700' }}>
              You have used at least 80% of a monthly limit. Upgrade to avoid interruptions.
            </Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.maxVideoLength')}: {stats.maxVideoDurationSeconds ?? 3}s
          </Text>
          {stats.chatModelLabel ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              Chat model: {stats.chatModelLabel}
            </Text>
          ) : null}
          {typeof stats.contextMessages === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              Context messages: {stats.contextMessages}
            </Text>
          ) : null}
          {typeof stats.maxTokensPerRequest === 'number' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              Max tokens per request: {stats.maxTokensPerRequest}
            </Text>
          ) : null}
          {typeof stats.documentsEnabled === 'boolean' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              Documents: {stats.documentsEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          ) : null}

          {Platform.OS === 'ios' ? (
            <>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Restore Purchases"
                disabled={busyTier !== null}
                onPress={async () => {
                  setBusyTier('free');
                  setStatusText('');
                  plansDebug('restoreButton:pressed', {
                    currentTier,
                    activeTier,
                    overviewTier: overview?.subscription.tier ?? null,
                    overviewStatus: overview?.subscription.status ?? null,
                  });
                  try {
                    await restorePurchases();
                    await refreshCustomerInfo();
                    await syncSubscriptionAndApplyTier().catch(() => null);
                    await loadBillingData({ force: true });
                    await refreshAuthUser().catch(() => {});
                    plansDebug('restoreButton:resolved', {
                      currentTierAfter: Platform.OS === 'ios' ? activeTier : (overview?.subscription.tier ?? 'free'),
                    });
                    setStatusText('Purchases restored successfully!');
                  } catch (err) {
                    plansDebug('restoreButton:error', {
                      message: err instanceof Error ? err.message : 'unknown',
                    });
                    setStatusText((err as Error).message);
                  } finally {
                    setBusyTier(null);
                    plansDebug('restoreButton:end');
                  }
                }}
                className="mt-3 h-10 items-center justify-center rounded-full px-4"
                style={{
                  borderWidth: 1.2,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  Restore Purchases
                </Text>
              </TouchableOpacity>
              {activeTier !== 'free' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.account.cancelSubscription')}
                  disabled={isCancelLoading}
                  onPress={() => {
                    void onOpenIosSubscriptionManagement();
                  }}
                  className="mt-2 h-10 items-center justify-center rounded-full px-4"
                  style={{
                    borderWidth: 1.2,
                    borderColor: '#E11D48',
                    backgroundColor: isDark ? 'rgba(127,29,29,0.22)' : 'rgba(254,226,226,0.95)',
                    opacity: isCancelLoading ? 0.75 : 1,
                  }}
                >
                  <View className="flex-row items-center">
                    {isCancelLoading ? <ActivityIndicator size="small" color="#E11D48" /> : null}
                    <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '700', marginLeft: isCancelLoading ? 8 : 0 }}>
                      {t('settings.account.cancelSubscription')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('plans.managePortal')}
              disabled={isPortalLoading}
              onPress={() => {
                void onOpenBillingPortal();
              }}
              className="mt-3 h-10 items-center justify-center rounded-full px-4"
              style={{
                borderWidth: 1.2,
                borderColor: colors.primary,
                opacity: isPortalLoading ? 0.75 : 1,
              }}
            >
              <View className="flex-row items-center">
                {isPortalLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: '700',
                    marginLeft: isPortalLoading ? 8 : 0,
                  }}
                >
                  {t('plans.managePortal')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>
          {t('plans.availablePlans')}
        </Text>

        {!!statusText ? (
          <View
            className="mb-3 rounded-xl border px-3 py-2"
            style={{ borderColor: colors.border, backgroundColor: isDark ? '#11131A' : '#F8FAFC' }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {statusText}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
              {t('plans.loading')}
            </Text>
          </View>
        ) : null}

        {!loading && Platform.OS === 'ios' && !offering ? (
          <View
            className="mb-3 rounded-xl border px-3 py-2"
            style={{ borderColor: colors.border, backgroundColor: isDark ? '#11131A' : '#F8FAFC' }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Subscription purchase is temporarily unavailable. Plan details are shown below.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry loading plans"
              disabled={isRefreshingOfferings}
              onPress={() => {
                void retryLoadIosPlans();
              }}
              className="mt-3 h-10 items-center justify-center rounded-full px-4"
              style={{
                borderWidth: 1.2,
                borderColor: colors.primary,
                opacity: isRefreshingOfferings ? 0.75 : 1,
              }}
            >
              {isRefreshingOfferings ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  Retry
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {displayPlans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isBusy = busyTier === plan.tier;
          const isDowngrade = TIER_RANK[plan.tier] < TIER_RANK[currentTier];
          const isFreeIncluded = plan.tier === 'free' && currentTier !== 'free';
          const hidePlanActionButton = Platform.OS === 'ios' && plan.tier === 'free' && currentTier !== 'free';
          const isPlanActionDisabled = isCurrent || isBusy || plan.isActive === false || isFreeIncluded;
          const subscriptionLength = plan.price?.interval === 'yr' ? 'Yearly' : 'Monthly';
          const planBenefits = normalizeBenefits(plan.benefits);
          // on iOS, if we mapped a rank, maybe we don't know the exact order from RC. 
          // getHighestTier logic exists to evaluate 'free' vs 'pro', but we can just use simple === checks.
          return (
            <View
              key={plan.tier}
              className="mb-3 rounded-2xl border p-3"
              style={{
                borderColor: isCurrent ? colors.primary : colors.border,
                backgroundColor: isCurrent ? `${colors.primary}0F` : isDark ? '#101015' : '#FFFFFF',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1">
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                    {plan.name || tierLabel(plan.tier)}
                  </Text>
                  {!!plan.description ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                      {plan.description}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>
                    Subscription length: {subscriptionLength}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>
                  {typeof plan.price?.amount === 'number' && typeof plan.price?.currency === 'string'
                    ? `${plan.price.amount.toFixed(2)} ${plan.price.currency}`
                    : typeof plan.price?.amount === 'number'
                      ? `$${plan.price.amount.toFixed(2)}`
                      : '$0'}
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    /{plan.price?.interval ?? 'mo'}
                  </Text>
                </Text>
              </View>

              {planBenefits.length > 0 ? (
                <View className="mt-3 gap-1.5">
                  {planBenefits.map((benefit, benefitIndex) => (
                    <View key={`${plan.tier}-${benefitIndex}`} className="flex-row items-start">
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginTop: 1 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8, flex: 1 }}>
                        {benefit}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {!hidePlanActionButton ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    isCurrent
                      ? t('plans.currentPlan')
                      : isFreeIncluded
                        ? t('plans.included')
                      : t('plans.upgradeTo', { plan: plan.name || tierLabel(plan.tier) })
                  }
                  disabled={isPlanActionDisabled}
                  onPress={() => {
                    requestUpgrade(plan.tier);
                  }}
                  className="mt-3 h-10 items-center justify-center rounded-full px-4"
                  style={{
                    backgroundColor:
                      isPlanActionDisabled
                        ? isDark ? '#23232B' : '#ECECF2'
                        : colors.primary,
                    opacity: isBusy ? 0.75 : 1,
                  }}
                >
                  <Text
                    style={{
                      color:
                        isPlanActionDisabled
                          ? colors.textSecondary
                          : '#FFFFFF',
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {isCurrent
                      ? t('plans.currentPlan')
                      : isFreeIncluded
                        ? t('plans.included')
                      : plan.isActive === false
                        ? t('plans.unavailable')
                        : isBusy
                          ? t('plans.redirecting')
                          : isDowngrade
                            ? 'Downgrade'
                            : t('plans.upgrade')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View
          className="mb-3 rounded-xl border px-3 py-2"
          style={{ borderColor: colors.border, backgroundColor: isDark ? '#11131A' : '#F8FAFC' }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            By subscribing, you agree to our Privacy Policy and Terms of Use.
          </Text>
          <View className="mt-2 flex-row items-center">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open Privacy Policy Screen"
              onPress={() => {
                router.push('/privacy-policy');
              }}
              className="mr-3 rounded-full px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: colors.primary }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open Terms of Use Screen"
              onPress={() => {
                router.push('/terms-of-service');
              }}
              className="rounded-full px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: colors.primary }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </View>
    </RequireAuthRoute>
  );
}








