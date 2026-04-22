import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { purchasePackage } from '@/services/revenuecat/purchases';
import { getActiveExpirationDate, resolveRCTier } from '@/services/revenuecat/entitlements';
import { API_BASE_URL } from '@/lib';
import { clearPendingBillingTier, setPendingBillingTier } from '@/services';
import type { SubscriptionOverview, SubscriptionPlan, SubscriptionTier, UsageSnapshot } from '@/types';

const PRIVACY_POLICY_URL = 'https://www.cafaai.com/privacy';
const TERMS_OF_USE_URL = 'https://www.cafaai.com/terms';

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

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  cafa_smart: 1,
  cafa_pro: 2,
  cafa_max: 3,
};

function formatLimit(limit?: number | null) {
  if (typeof limit !== 'number' || limit < 0) return '\u221e';
  return `${limit}`;
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

function resolveOverviewUsageCount(
  usage: SubscriptionOverview['usage'] | Record<string, unknown> | undefined,
  key: 'chat' | 'images' | 'videos',
) {
  if (!usage || typeof usage !== 'object') return null;

  const record = usage as Record<string, unknown>;
  const direct =
    key === 'chat'
      ? asNumber(record.chatMessagesToday)
      : key === 'images'
        ? asNumber(record.imageGenerationsToday)
        : asNumber(record.videoGenerationsToday);
  if (direct != null) return direct;

  const nested = key === 'chat' ? record.chat : key === 'images' ? record.images : record.videos;
  if (nested && typeof nested === 'object') {
    return asNumber((nested as Record<string, unknown>).used);
  }
  return null;
}

function normalizeUsageAndLimits(
  overview: SubscriptionOverview | null,
  dailyUsage: UsageSnapshot | null,
  currentPlan?: SubscriptionPlan,
) {
  const limits = overview?.limits ?? currentPlan?.limits;
  const usage = overview?.usage;
  const chatUsedFromOverview = resolveOverviewUsageCount(usage, 'chat');
  const imageUsedFromOverview = resolveOverviewUsageCount(usage, 'images');
  const videoUsedFromOverview = resolveOverviewUsageCount(usage, 'videos');

  return {
    chatUsed: chatUsedFromOverview ?? dailyUsage?.chatUsed ?? 0,
    chatLimit: dailyUsage?.chatLimit ?? limits?.chatMessagesPerDay ?? 500,
    imageUsed: imageUsedFromOverview ?? dailyUsage?.imageUsed ?? 0,
    imageLimit: dailyUsage?.imageLimit ?? limits?.imageGenerationsPerDay ?? 5,
    videoUsed: videoUsedFromOverview ?? 0,
    videoLimit: limits?.videoGenerationsPerDay ?? 1,
    maxVideoDurationSeconds: limits?.maxVideoDurationSeconds ?? 3,
  };
}

export default function PlansScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { activeTier, offering, refreshCustomerInfo, refreshOffering, restorePurchases } = useRevenueCat();
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<SubscriptionTier | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [dailyUsage, setDailyUsage] = useState<UsageSnapshot | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [statusText, setStatusText] = useState('');
  const [showChangePlanPrompt, setShowChangePlanPrompt] = useState(false);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [showPlanUpdatedPrompt, setShowPlanUpdatedPrompt] = useState(false);
  const [updatedTier, setUpdatedTier] = useState<SubscriptionTier | null>(null);
  const [isRefreshingOfferings, setIsRefreshingOfferings] = useState(false);
  const appScheme = ((Constants.expoConfig as { scheme?: string } | undefined)?.scheme || 'cafa-ai').replace('://', '');
  const lastForegroundRefreshAtRef = useRef(0);
  const portalFlowActiveRef = useRef(false);
  const latestSubscriptionRef = useRef<{ tier: SubscriptionTier; status: string } | null>(null);

  const toErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Unknown request error.';
  };

  const loadBillingData = useCallback(async (options?: { force?: boolean }) => {
    try {
      const [nextOverview, nextPlansPayload, nextDailyUsage] = await Promise.all([
        getSubscriptionOverview({ force: options?.force }),
        getSubscriptionPlans({ force: options?.force }),
        getDailyUsage({ force: options?.force }),
      ]);
      setOverview(nextOverview);
      latestSubscriptionRef.current = {
        tier: nextOverview.subscription.tier,
        status: nextOverview.subscription.status,
      };
      setPlans(nextPlansPayload.plans ?? []);
      setDailyUsage(nextDailyUsage);
      return nextOverview;
    } catch (error) {
      const typedError = error as { code?: string; status?: number } | undefined;
      const message = toErrorMessage(error);
      console.log(
        `[plans-load:error] endpoints=${API_BASE_URL}/subscriptions/status,${API_BASE_URL}/subscriptions/plans,${API_BASE_URL}/users/me/usage code=${typedError?.code ?? 'unknown'} status=${typedError?.status ?? 'unknown'} message="${message}"`,
      );
      throw error;
    }
  }, []);

  const syncSubscriptionAfterCheckout = useCallback(async (requestedTier: SubscriptionTier) => {
    const timeoutAt = Date.now() + 60_000;
    while (Date.now() < timeoutAt) {
      try {
        const latest = await getSubscriptionOverview({ force: true });
        setOverview(latest);
        if (latest.subscription.tier === requestedTier && latest.subscription.status === 'active') {
          setStatusText(t('plans.upgradeVerified', { plan: tierLabel(requestedTier) }));
          await loadBillingData({ force: true });
          return;
        }
      } catch {
        // keep polling until timeout
      }
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
    setStatusText(t('plans.upgradeSyncPending'));
  }, [loadBillingData, t]);

  const syncSubscriptionAfterPortalReturn = useCallback(async () => {
    const previous = latestSubscriptionRef.current;
    const timeoutAt = Date.now() + 24_000;
    let latestOverview: SubscriptionOverview | null = null;
    let hadError = false;

    while (Date.now() < timeoutAt) {
      try {
        latestOverview = await loadBillingData({ force: true });
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
          portalFlowActiveRef.current = false;
          return;
        }
      } catch (error) {
        hadError = true;
        const typedError = error as { code?: string; status?: number } | undefined;
        const message = toErrorMessage(error);
        console.log(
          `[plans-portal-sync:error] endpoints=${API_BASE_URL}/subscriptions/status,${API_BASE_URL}/subscriptions/plans,${API_BASE_URL}/users/me/usage code=${typedError?.code ?? 'unknown'} status=${typedError?.status ?? 'unknown'} message="${message}"`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }

    if (hadError && !latestOverview) {
      setStatusText(t('plans.portalSyncError'));
    } else {
      setStatusText(t('plans.portalSyncNoChange'));
    }
    portalFlowActiveRef.current = false;
  }, [loadBillingData, t]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setStatusText('');
      try {
        await loadBillingData({ force: true });
      } catch (error) {
        setStatusText(
          toErrorMessage(error) || t('plans.loadError'),
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [loadBillingData, t]);

  useFocusEffect(
    useCallback(() => {
      // Drawer screens can stay mounted; refresh usage every time plans is focused.
      void loadBillingData({ force: true }).catch((error) => {
        const message = toErrorMessage(error);
        console.log(`[plans-focus-refresh:error] message="${message}"`);
      });
      return () => {};
    }, [loadBillingData]),
  );

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) return;
      console.log(`[plans-linking:handle] url=${url}`);
      if (isBillingSuccessUrl(url, appScheme)) {
        router.replace('/billing/success');
      } else if (isBillingCancelUrl(url, appScheme)) {
        router.replace('/billing/cancel');
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', (event) => {
      console.log(`[plans-linking:event] url=${event.url}`);
      handleUrl(event.url);
    });
    return () => sub.remove();
  }, [appScheme]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (portalFlowActiveRef.current) {
        void syncSubscriptionAfterPortalReturn();
        return;
      }
      if (Date.now() - lastForegroundRefreshAtRef.current < 12_000) return;
      lastForegroundRefreshAtRef.current = Date.now();
      void loadBillingData().catch((error) => {
        const typedError = error as { code?: string; status?: number } | undefined;
        const message = toErrorMessage(error);
        console.log(
          `[plans-foreground-refresh:error] endpoints=${API_BASE_URL}/subscriptions/status,${API_BASE_URL}/subscriptions/plans,${API_BASE_URL}/users/me/usage code=${typedError?.code ?? 'unknown'} status=${typedError?.status ?? 'unknown'} message="${message}"`,
        );
      });
    });
    return () => sub.remove();
  }, [loadBillingData, syncSubscriptionAfterPortalReturn]);

  const currentTier = Platform.OS === 'ios' ? activeTier : (overview?.subscription.tier ?? 'free');
  const subscriptionLifecycle = overview?.subscriptionLifecycle;

  const displayPlans = useMemo(() => {
    if (Platform.OS === 'ios') {
      if (!offering) {
        // Keep plan details visible for App Review, but disable purchasing until RC products load.
        return plans.map((plan) => ({ ...plan, isActive: false }));
      }
      return offering.availablePackages
        .filter((pkg) => pkg.product != null)
        .map((pkg): SubscriptionPlan & { _rcPackage: any } => {
          const titleWords = pkg.product.title.toLowerCase();
          let tier: SubscriptionTier = 'free';
          if (pkg.identifier.includes('max') || titleWords.includes('max')) tier = 'cafa_max';
          else if (pkg.identifier.includes('pro') || titleWords.includes('pro')) tier = 'cafa_pro';
          else if (pkg.identifier.includes('smart') || titleWords.includes('smart')) tier = 'cafa_smart';

          return {
            tier,
            name: pkg.product.title,
            description: pkg.product.description,
            isActive: true,
            price: {
              amount: Number(pkg.product.price.toFixed(2)),
              currency: pkg.product.currencyCode,
              interval: pkg.product.subscriptionPeriod === 'P1Y' ? 'yr' : 'mo',
            },
            _rcPackage: pkg,
          };
        }).filter((p) => p.tier !== 'free');
    }
    return plans;
  }, [offering, plans]);

  const currentPlan = useMemo(
    () => displayPlans.find((plan) => plan.tier === currentTier),
    [currentTier, displayPlans],
  );
  const stats = normalizeUsageAndLimits(overview, dailyUsage, currentPlan);
  const openCheckoutUrl = async (
    url: string,
    mode: 'checkout' | 'portal' = 'checkout',
    returnStrategy: 'redirect_to_app' | 'redirect_to_web' | string = 'redirect_to_web',
    expectedSuccessUrl?: string,
    expectedCancelUrl?: string,
  ) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Checkout URL is invalid.');
    }

    if (mode === 'checkout' && Platform.OS === 'ios' && returnStrategy === 'redirect_to_app') {
      try {
        const redirectUri = `${appScheme}://billing`;
        const authResult = await WebBrowser.openAuthSessionAsync(url, redirectUri);
        console.log(
          `[plans-redirect:auth-session] type=${authResult.type} redirectUri=${redirectUri} returnedUrl=${'url' in authResult ? authResult.url ?? 'none' : 'none'}`,
        );
        if (authResult.type === 'success' && authResult.url) {
          const expectedSuccessPrefix = expectedSuccessUrl
            ? expectedSuccessUrl.replace('?session_id={CHECKOUT_SESSION_ID}', '')
            : null;
          if (expectedSuccessPrefix && authResult.url.startsWith(expectedSuccessPrefix)) {
            console.log('[plans-redirect:route] matched=checkout-success-url');
            router.replace('/billing/success');
            return;
          }
          if (expectedCancelUrl && authResult.url.startsWith(expectedCancelUrl)) {
            console.log('[plans-redirect:route] matched=checkout-cancel-url');
            router.replace('/billing/cancel');
            return;
          }
          if (isBillingSuccessUrl(authResult.url, appScheme)) {
            console.log('[plans-redirect:route] matched=billing/success');
            router.replace('/billing/success');
            return;
          }
          if (isBillingCancelUrl(authResult.url, appScheme)) {
            console.log('[plans-redirect:route] matched=billing/cancel');
            router.replace('/billing/cancel');
            return;
          }
        }
      } catch {
        console.log('[plans-redirect:auth-session] failed, falling back to browser');
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
      console.log('[plans-redirect:browser] openBrowserAsync failed, trying Linking.openURL');
      // Fallback below.
    }

    const canOpen = await Linking.canOpenURL(url);
    console.log(`[plans-redirect:linking] canOpen=${canOpen}`);
    if (!canOpen) {
      throw new Error('Could not open Stripe checkout URL.');
    }
    await Linking.openURL(url);
    console.log('[plans-redirect:linking] opened with Linking.openURL');
  };

  const openExternalLegalUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      setStatusText('Unable to open legal link right now. Please try again.');
      return;
    }
    await Linking.openURL(url);
  };

  const onUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    setBusyTier(tier);
    setStatusText('');

    try {
      await setPendingBillingTier(tier);
      const checkout = await createCheckoutSession(tier, {
        platform: 'mobile',
      });
      const resolvedSuccessUrl = checkout.successUrl;
      const resolvedCancelUrl = checkout.cancelUrl;
      const returnStrategy = (checkout as { returnStrategy?: string }).returnStrategy ?? 'redirect_to_web';
      const requiresCheckout = (checkout as { requiresCheckout?: boolean }).requiresCheckout !== false;
      if (requiresCheckout && checkout.url) {
        await openCheckoutUrl(checkout.url, 'checkout', returnStrategy, resolvedSuccessUrl, resolvedCancelUrl);
        setStatusText(t('plans.checkoutOpened'));
        await syncSubscriptionAfterCheckout(tier);
      } else {
        await clearPendingBillingTier();
        await loadBillingData({ force: true });
        setStatusText(t('plans.planUpdatedInPlace', { plan: tierLabel(tier) }));
        setUpdatedTier(tier);
        setShowPlanUpdatedPrompt(true);
      }
    } catch (error) {
      const typedError = error as { message?: string; code?: string; status?: number; redirectUrl?: string } | undefined;
      const rawMessage = error instanceof Error ? error.message : t('plans.checkoutError');
      if (typedError?.code === 'MANAGE_EXISTING_SUBSCRIPTION' && typedError.redirectUrl) {
        try {
          await clearPendingBillingTier();
          await openCheckoutUrl(typedError.redirectUrl, 'portal');
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
      console.log(
        `[plans-upgrade:error] endpoint=${API_BASE_URL}/subscriptions/checkout tier=${tier} currentTier=${currentTier} currentStatus=${overview?.subscription.status ?? 'unknown'} code=${typedError?.code ?? 'unknown'} status=${typedError?.status ?? 'unknown'} message="${rawMessage}"`,
      );
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
      const targetPlan = displayPlans.find(p => p.tier === tier) as any;
      if (!targetPlan?._rcPackage) return;

      setBusyTier(tier);
      setStatusText('');
      try {
        const customerInfo = await purchasePackage(targetPlan._rcPackage);
        const resolvedTier = resolveRCTier(customerInfo);
        const requestedDowngrade = TIER_RANK[tier] < TIER_RANK[currentTier];
        const downgradeScheduled = requestedDowngrade && TIER_RANK[resolvedTier] > TIER_RANK[tier];
        const effectiveDate = getActiveExpirationDate(customerInfo);
        await refreshCustomerInfo();

        if (downgradeScheduled) {
          setStatusText(
            t('plans.downgradeScheduled', {
              plan: tierLabel(tier),
              date: effectiveDate ? effectiveDate.toLocaleDateString() : 'the next renewal date',
            }),
          );
        } else {
          setStatusText(t('plans.planUpdatedInPlace', { plan: tierLabel(tier) }));
          setUpdatedTier(tier);
          setShowPlanUpdatedPrompt(true);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : t('plans.checkoutError');
        console.log(`[plans-upgrade:ios] error="${errorMsg}"`);
        // if user cancelled, don't show an ugly error message
        if (!errorMsg.toLowerCase().includes('cancel')) {
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
    setIsPortalLoading(true);
    setStatusText('');
    try {
      const returnUrl = `${appScheme}://billing/return`;
      const portal = await createBillingPortalSession({
        platform: 'mobile',
        returnUrl,
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
      console.log(
        `[plans-portal:error] endpoint=${API_BASE_URL}/subscriptions/portal message="${message}"`,
      );
      setStatusText(message);
    } finally {
      setIsPortalLoading(false);
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
          {Platform.OS !== 'ios' && subscriptionLifecycle?.willCancelAtPeriodEnd && subscriptionLifecycle.scheduledCancelAt ? (
            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              {t('plans.cancelsOn', { date: new Date(subscriptionLifecycle.scheduledCancelAt).toLocaleDateString() })}
            </Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
            {t('plans.chatUsed')}: {stats.chatUsed} / {formatLimit(stats.chatLimit)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.imagesUsed')}: {stats.imageUsed} / {formatLimit(stats.imageLimit)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.videosUsed')}: {stats.videoUsed} / {formatLimit(stats.videoLimit)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {t('plans.maxVideoLength')}: {stats.maxVideoDurationSeconds ?? 3}s
          </Text>

          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Restore Purchases"
              disabled={busyTier !== null}
              onPress={async () => {
                setBusyTier('free');
                setStatusText('');
                try {
                  await restorePurchases();
                  await refreshCustomerInfo();
                  setStatusText('Purchases restored successfully!');
                } catch (err) {
                  setStatusText((err as Error).message);
                } finally {
                  setBusyTier(null);
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
          const subscriptionLength = plan.price?.interval === 'yr' ? 'Yearly' : 'Monthly';
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

              {!!plan.benefits?.length ? (
                <View className="mt-3 gap-1.5">
                  {plan.benefits.map((benefit) => (
                    <View key={`${plan.tier}-${benefit}`} className="flex-row items-start">
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginTop: 1 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8, flex: 1 }}>
                        {benefit}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  isCurrent
                    ? t('plans.currentPlan')
                    : t('plans.upgradeTo', { plan: plan.name || tierLabel(plan.tier) })
                }
                disabled={isCurrent || isBusy || plan.isActive === false}
                onPress={() => {
                  requestUpgrade(plan.tier);
                }}
                className="mt-3 h-10 items-center justify-center rounded-full px-4"
                style={{
                  backgroundColor:
                    isCurrent || plan.isActive === false
                      ? isDark ? '#23232B' : '#ECECF2'
                      : colors.primary,
                  opacity: isBusy ? 0.75 : 1,
                }}
              >
                <Text
                  style={{
                    color:
                      isCurrent || plan.isActive === false
                        ? colors.textSecondary
                        : '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {isCurrent
                    ? t('plans.currentPlan')
                    : plan.isActive === false
                      ? t('plans.unavailable')
                      : isBusy
                        ? t('plans.redirecting')
                        : isDowngrade
                          ? 'Downgrade'
                          : t('plans.upgrade')}
                </Text>
              </TouchableOpacity>
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
              accessibilityLabel="Open Privacy Policy"
              onPress={() => {
                void openExternalLegalUrl(PRIVACY_POLICY_URL);
              }}
              className="mr-3 rounded-full px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: colors.primary }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open Terms of Use"
              onPress={() => {
                void openExternalLegalUrl(TERMS_OF_USE_URL);
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
