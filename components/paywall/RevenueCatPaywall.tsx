import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { useAppTheme } from '@/hooks';
import { useRevenueCat } from '@/context/RevenueCatContext';

type RevenueCatPaywallProps = {
  /** Called when the user successfully purchases or already has access */
  onPurchaseSuccess?: () => void;
  /** Called when the user dismisses the paywall without purchasing */
  onDismiss?: () => void;
};

/**
 * Imperative paywall presenter — call this to show the RC paywall modal.
 * Returns true if the user completed a purchase or already had access.
 */
export async function presentPaywall(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const result = await RevenueCatUI.presentPaywall();
    return (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    );
  } catch (error) {
    console.warn('[paywall] presentPaywall failed', error);
    return false;
  }
}

/**
 * Imperative Customer Center presenter — call once from "Manage Subscription" buttons.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (error) {
    console.warn('[paywall] presentCustomerCenter failed', error);
  }
}

/**
 * Inline Paywall component — renders the RC paywall directly in the screen.
 * Used inside the /pro route.
 */
export function RevenueCatPaywall({ onPurchaseSuccess, onDismiss }: RevenueCatPaywallProps) {
  const { colors } = useAppTheme();
  const { restorePurchases, refreshCustomerInfo, isLoading } = useRevenueCat();
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    setStatusMessage('');
    try {
      await restorePurchases();
      await refreshCustomerInfo();
      setStatusMessage('Purchases restored successfully!');
      onPurchaseSuccess?.();
    } catch {
      setStatusMessage('No previous purchases found to restore.');
    } finally {
      setRestoring(false);
    }
  }, [refreshCustomerInfo, onPurchaseSuccess, restorePurchases]);

  if (Platform.OS !== 'ios') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
          In-app purchases are only available on iOS.{'\n'}
          To upgrade, please visit cafaai.com.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* RC Native Paywall UI */}
      <RevenueCatUI.Paywall
        onPurchaseStarted={() => setStatusMessage('')}
        onPurchaseCompleted={({ customerInfo: _ }) => {
          setStatusMessage('');
          refreshCustomerInfo().catch(() => {});
          onPurchaseSuccess?.();
        }}
        onPurchaseCancelled={() => setStatusMessage('')}
        onPurchaseError={({ error }) => {
          setStatusMessage(error.message ?? 'Purchase failed. Please try again.');
        }}
        onRestoreCompleted={({ customerInfo: _ }) => {
          setStatusMessage('Purchases restored!');
          refreshCustomerInfo().catch(() => {});
          onPurchaseSuccess?.();
        }}
        onRestoreError={({ error }) => {
          setStatusMessage(error.message ?? 'Restore failed. Please try again.');
        }}
        onDismiss={onDismiss}
      />

      {/* Status message */}
      {!!statusMessage && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Manual restore button (fallback) */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Restore purchases"
        disabled={restoring || isLoading}
        onPress={handleRestore}
        style={{ paddingVertical: 12, alignItems: 'center' }}
      >
        {restoring ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Restore Purchases
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
