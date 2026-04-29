import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Purchases from 'react-native-purchases';

import { useAppContext } from '@/context/AppContext';
import { initRevenueCat, identifyUser, resetUser, isRCEnabled } from '@/services/revenuecat';
import {
  fetchCustomerInfo,
  fetchOffering,
  restorePurchases as restorePurchasesService,
  syncPurchases as syncPurchasesService,
} from '@/services/revenuecat/purchases';
import { resolveRCTier, getHighestTier } from '@/services/revenuecat/entitlements';
import type { RCCustomerInfo, RCOffering, RevenueCatState } from '@/types/revenuecat.types';
import type { SubscriptionTier } from '@/types';

type RevenueCatContextValue = RevenueCatState & {
  /** The subscription tier returned by the backend */
  backendTier: SubscriptionTier;
  /** True if the user is not free */
  isPro: boolean;
};

const RevenueCatContext = createContext<RevenueCatContextValue | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { authUser, isAuthenticated } = useAppContext();
  const [customerInfo, setCustomerInfo] = useState<RCCustomerInfo | null>(null);
  const [offering, setOffering] = useState<RCOffering | null>(null);
  const [isLoading, setIsLoading] = useState(isRCEnabled);
  const [error, setError] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const isReconcilingRef = useRef(false);
  const rcDebug = useCallback((_event: string, _payload?: Record<string, unknown>) => {}, []);

  const refreshOffering = useCallback(async (): Promise<RCOffering | null> => {
    if (!isRCEnabled) return null;
    const nextOffering = await fetchOffering();
    rcDebug('offering:refresh', {
      hasOffering: Boolean(nextOffering),
      packageCount: nextOffering?.availablePackages?.length ?? 0,
    });
    setOffering(nextOffering);
    return nextOffering;
  }, [rcDebug]);

  const reconcileIosEntitlements = useCallback(async (
    info: RCCustomerInfo | null,
    options?: { forceSync?: boolean },
  ): Promise<RCCustomerInfo | null> => {
    if (!isRCEnabled || !isAuthenticated || !authUser?.id) return info;

    let resolvedInfo = info;
    let resolvedTier = resolveRCTier(resolvedInfo);
    rcDebug('reconcile:start', {
      appUserId: authUser.id,
      authTier: authUser.subscriptionTier ?? 'free',
      resolvedTier,
      forceSync: Boolean(options?.forceSync),
      hasInfo: Boolean(info),
      activeEntitlements: Object.keys(info?.entitlements?.active ?? {}),
      activeSubscriptions: info?.activeSubscriptions ?? [],
    });
    if (resolvedTier !== 'free') {
      rcDebug('reconcile:resolved-without-sync', { resolvedTier });
      return resolvedInfo;
    }

    // Only sync App Store receipts when explicitly requested by user action
    // (e.g. tapping "Restore Purchases" or a purchase-recovery flow).
    if (isReconcilingRef.current) return resolvedInfo;
    if (!options?.forceSync) return resolvedInfo;

    isReconcilingRef.current = true;
    try {
      rcDebug('reconcile:syncPurchases:start', { appUserId: authUser.id });
      const syncedInfo = await syncPurchasesService();
      if (syncedInfo) {
        resolvedInfo = syncedInfo;
        resolvedTier = resolveRCTier(syncedInfo);
      }
      rcDebug('reconcile:syncPurchases:result', {
        resolvedTier,
        hasInfo: Boolean(syncedInfo),
        activeEntitlements: Object.keys(syncedInfo?.entitlements?.active ?? {}),
        activeSubscriptions: syncedInfo?.activeSubscriptions ?? [],
      });
      return resolvedInfo;
    } finally {
      isReconcilingRef.current = false;
    }
  }, [authUser?.id, authUser?.subscriptionTier, isAuthenticated, rcDebug]);

  // ─── Init RC once on mount (iOS only) ────────────────────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    initRevenueCat();

    // Listen for real-time customerInfo updates (e.g. renewal, cancellation)
    const listener = (info: RCCustomerInfo) => {
      rcDebug('listener:customerInfoUpdate', {
        appUserId: info?.originalAppUserId ?? null,
        rcTier: resolveRCTier(info),
        activeEntitlements: Object.keys(info?.entitlements?.active ?? {}),
        activeSubscriptions: info?.activeSubscriptions ?? [],
      });
      setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [rcDebug]);

  // ─── Fetch offerings once on mount (iOS only) ────────────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    refreshOffering().catch(() => {});
  }, [refreshOffering]);

  // ─── Identify / reset user when auth state changes ───────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    const currentId = authUser?.id ?? null;

    if (isAuthenticated && currentId && currentId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentId;

      setIsLoading(true);
      rcDebug('identify:start', { appUserId: currentId });
      identifyUser(currentId)
        .then(() => fetchCustomerInfo())
        .then((info) => reconcileIosEntitlements(info))
        .then((info) => {
          rcDebug('identify:resolved', {
            appUserId: currentId,
            rcTier: resolveRCTier(info),
            activeEntitlements: Object.keys(info?.entitlements?.active ?? {}),
            activeSubscriptions: info?.activeSubscriptions ?? [],
          });
          setCustomerInfo(info);
          setError(null);
        })
        .catch((e) => {
          const message = e instanceof Error ? e.message : 'Failed to load subscription info.';
          rcDebug('identify:error', { appUserId: currentId, message });
          setError(message);
        })
        .finally(() => setIsLoading(false));
    }

    if (!isAuthenticated && prevUserIdRef.current !== null) {
      prevUserIdRef.current = null;
      setCustomerInfo(null);
      resetUser().catch(() => {});
    }
  }, [authUser?.id, isAuthenticated, reconcileIosEntitlements]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const rcTier = resolveRCTier(customerInfo);
  const backendTier = authUser?.subscriptionTier || 'free';
  // For authenticated users, backend/sync is canonical source of truth.
  // RC tier is still useful for diagnostics and purchase flow internals.
  const activeTier = isAuthenticated ? backendTier : (isRCEnabled ? getHighestTier(rcTier, backendTier) : backendTier);
  const isPro = activeTier !== 'free';

  // ─── Actions ─────────────────────────────────────────────────────────────
  const refreshCustomerInfo = useCallback(async () => {
    if (!isRCEnabled) return;
    try {
      rcDebug('refreshCustomerInfo:start', {
        appUserId: authUser?.id ?? null,
        authTier: authUser?.subscriptionTier ?? 'free',
      });
      const info = await fetchCustomerInfo();
      const reconciled = await reconcileIosEntitlements(info);
      rcDebug('refreshCustomerInfo:resolved', {
        rcTier: resolveRCTier(reconciled),
        activeEntitlements: Object.keys(reconciled?.entitlements?.active ?? {}),
        activeSubscriptions: reconciled?.activeSubscriptions ?? [],
      });
      setCustomerInfo(reconciled);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to refresh subscription info.';
      rcDebug('refreshCustomerInfo:error', { message });
      setError(message);
    }
  }, [authUser?.id, authUser?.subscriptionTier, rcDebug, reconcileIosEntitlements]);

  const restorePurchases = useCallback(async () => {
    if (!isRCEnabled) return;
    setIsLoading(true);
    try {
      rcDebug('restorePurchases:start', {
        appUserId: authUser?.id ?? null,
        authTier: authUser?.subscriptionTier ?? 'free',
      });
      const info = await restorePurchasesService();
      const reconciled = await reconcileIosEntitlements(info, { forceSync: true });
      rcDebug('restorePurchases:resolved', {
        rcTier: resolveRCTier(reconciled),
        activeEntitlements: Object.keys(reconciled?.entitlements?.active ?? {}),
        activeSubscriptions: reconciled?.activeSubscriptions ?? [],
      });
      setCustomerInfo(reconciled);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to restore purchases.';
      rcDebug('restorePurchases:error', { message });
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id, authUser?.subscriptionTier, rcDebug, reconcileIosEntitlements]);

  useEffect(() => {
    if (!isRCEnabled || !isAuthenticated || !authUser?.id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      rcDebug('appState:active-refresh', {
        appUserId: authUser.id,
        authTier: authUser.subscriptionTier ?? 'free',
      });
      void refreshCustomerInfo();
    });
    return () => sub.remove();
  }, [authUser?.id, authUser?.subscriptionTier, isAuthenticated, rcDebug, refreshCustomerInfo]);

  useEffect(() => {
    rcDebug('state:snapshot', {
      appUserId: authUser?.id ?? null,
      authTier: authUser?.subscriptionTier ?? 'free',
      rcTier,
      activeTier,
      isAuthenticated,
      hasCustomerInfo: Boolean(customerInfo),
      activeEntitlements: Object.keys(customerInfo?.entitlements?.active ?? {}),
      activeSubscriptions: customerInfo?.activeSubscriptions ?? [],
      error,
    });
  }, [
    activeTier,
    authUser?.id,
    authUser?.subscriptionTier,
    customerInfo,
    error,
    isAuthenticated,
    rcDebug,
    rcTier,
  ]);

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      customerInfo,
      offering,
      rcTier,
      backendTier,
      activeTier,
      isPro,
      isLoading,
      error,
      refreshCustomerInfo,
      refreshOffering,
      restorePurchases,
    }),
    [
      customerInfo,
      offering,
      rcTier,
      backendTier,
      activeTier,
      isPro,
      isLoading,
      error,
      refreshCustomerInfo,
      refreshOffering,
      restorePurchases,
    ],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatContextValue {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used within RevenueCatProvider');
  }
  return ctx;
}
