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
  const { authUser, isAuthenticated, setAuthSubscriptionTier } = useAppContext();
  const [customerInfo, setCustomerInfo] = useState<RCCustomerInfo | null>(null);
  const [offering, setOffering] = useState<RCOffering | null>(null);
  const [isLoading, setIsLoading] = useState(isRCEnabled);
  const [error, setError] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const isReconcilingRef = useRef(false);

  const refreshOffering = useCallback(async (): Promise<RCOffering | null> => {
    if (!isRCEnabled) return null;
    const nextOffering = await fetchOffering();
    setOffering(nextOffering);
    return nextOffering;
  }, []);

  const reconcileIosEntitlements = useCallback(async (
    info: RCCustomerInfo | null,
    options?: { forceSync?: boolean },
  ): Promise<RCCustomerInfo | null> => {
    if (!isRCEnabled || !isAuthenticated || !authUser?.id) return info;

    let resolvedInfo = info;
    let resolvedTier = resolveRCTier(resolvedInfo);
    if (resolvedTier !== 'free') {
      setAuthSubscriptionTier(resolvedTier);
      return resolvedInfo;
    }

    // If local entitlements look free, proactively sync App Store receipts.
    if (isReconcilingRef.current) return resolvedInfo;
    if (!options?.forceSync && (authUser.subscriptionTier ?? 'free') !== 'free') return resolvedInfo;

    isReconcilingRef.current = true;
    try {
      const syncedInfo = await syncPurchasesService();
      if (syncedInfo) {
        resolvedInfo = syncedInfo;
        resolvedTier = resolveRCTier(syncedInfo);
      }
      if (resolvedTier !== 'free') {
        setAuthSubscriptionTier(resolvedTier);
      }
      return resolvedInfo;
    } finally {
      isReconcilingRef.current = false;
    }
  }, [authUser?.id, authUser?.subscriptionTier, isAuthenticated, setAuthSubscriptionTier]);

  // ─── Init RC once on mount (iOS only) ────────────────────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    initRevenueCat();

    // Listen for real-time customerInfo updates (e.g. renewal, cancellation)
    const listener = (info: RCCustomerInfo) => {
      setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // ─── Fetch offerings once on mount (iOS only) ────────────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    refreshOffering().catch((e) => {
        if (__DEV__) {
          console.warn('[revenuecat:context] fetchOffering failed', e);
        }
      });
  }, [refreshOffering]);

  // ─── Identify / reset user when auth state changes ───────────────────────
  useEffect(() => {
    if (!isRCEnabled) return;

    const currentId = authUser?.id ?? null;

    if (isAuthenticated && currentId && currentId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentId;

      setIsLoading(true);
      identifyUser(currentId)
        .then(() => fetchCustomerInfo())
        .then((info) => reconcileIosEntitlements(info, { forceSync: true }))
        .then((info) => {
          setCustomerInfo(info);
          setError(null);
        })
        .catch((e) => {
          const message = e instanceof Error ? e.message : 'Failed to load subscription info.';
          if (__DEV__) {
             console.log('[revenuecat:context] identify/fetch failed', e);
          }
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
  const activeTier = isRCEnabled ? getHighestTier(rcTier, backendTier) : backendTier;
  const isPro = activeTier !== 'free';

  // ─── Actions ─────────────────────────────────────────────────────────────
  const refreshCustomerInfo = useCallback(async () => {
    if (!isRCEnabled) return;
    try {
      const info = await fetchCustomerInfo();
      const reconciled = await reconcileIosEntitlements(info);
      setCustomerInfo(reconciled);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to refresh subscription info.';
      setError(message);
    }
  }, [reconcileIosEntitlements]);

  const restorePurchases = useCallback(async () => {
    if (!isRCEnabled) return;
    setIsLoading(true);
    try {
      const info = await restorePurchasesService();
      const reconciled = await reconcileIosEntitlements(info, { forceSync: true });
      setCustomerInfo(reconciled);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to restore purchases.';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [reconcileIosEntitlements]);

  useEffect(() => {
    if (!isRCEnabled || !isAuthenticated || !authUser?.id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshCustomerInfo();
    });
    return () => sub.remove();
  }, [authUser?.id, isAuthenticated, refreshCustomerInfo]);

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
