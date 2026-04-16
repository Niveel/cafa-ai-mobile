import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type { SubscriptionTier } from '@/types/billing.types';

/** Thin re-exports so the rest of the app never imports directly from the RC SDK */
export type RCCustomerInfo = CustomerInfo;
export type RCOffering = PurchasesOffering;
export type RCPackage = PurchasesPackage;

export type RevenueCatState = {
  /** RC CustomerInfo — null until first fetch or on Android */
  customerInfo: RCCustomerInfo | null;
  /** Default RC offering — null until fetched */
  offering: RCOffering | null;
  /** The resolved highest subscription tier from RC entitlements */
  rcTier: SubscriptionTier;
  /** The final active tier based on evaluating backend and RC tiers */
  activeTier: SubscriptionTier;
  /** True while the initial RC fetch is in progress */
  isLoading: boolean;
  /** Last RC error, if any */
  error: string | null;
  /** Call after a successful RC purchase to refresh customerInfo */
  refreshCustomerInfo: () => Promise<void>;
  /** Re-fetch current offering from RevenueCat */
  refreshOffering: () => Promise<RCOffering | null>;
  /** Restore App Store purchases */
  restorePurchases: () => Promise<void>;
};
