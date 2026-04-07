import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuthRoute, SecondaryNav } from '@/components';
import { getSubscriptionOverview, invalidateBillingCache } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { clearPendingBillingTier, getPendingBillingTier } from '@/services';
import type { SubscriptionTier } from '@/types';

export default function BillingSuccessScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const [syncing, setSyncing] = useState(true);
  const [syncMessage, setSyncMessage] = useState('');
  const [resolvedTier, setResolvedTier] = useState<SubscriptionTier | null>(null);

  const sessionId = useMemo(
    () => (typeof params.session_id === 'string' ? params.session_id : ''),
    [params.session_id],
  );

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      setSyncing(true);
      setSyncMessage(t('plans.checkoutOpened'));
      const pendingTier = await getPendingBillingTier();
      const timeoutAt = Date.now() + 60_000;

      while (!cancelled && Date.now() < timeoutAt) {
        try {
          const overview = await getSubscriptionOverview({ force: true });
          const status = overview.subscription.status;
          const tier = overview.subscription.tier;
          const isActive = status === 'active';
          const tierMatched = pendingTier ? tier === pendingTier : tier !== 'free';

          if (isActive && tierMatched) {
            await clearPendingBillingTier();
            invalidateBillingCache();
            if (!cancelled) {
              setResolvedTier(tier);
              setSyncMessage(t('plans.upgradeVerified', { plan: tier === 'free' ? 'Free' : tier.replace('cafa_', 'Cafa ').replace(/\b\w/g, (m) => m.toUpperCase()) }));
              setSyncing(false);
            }
            return;
          }
        } catch {
          // keep polling
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!cancelled) {
        setSyncMessage(t('plans.upgradeSyncPending'));
        setSyncing(false);
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title={t('plans.billingSuccessTitle')} topOffset={Math.max(insets.top, 0)} />
        <View className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
            {t('plans.billingSuccessTitle')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
            {syncMessage || t('plans.billingSuccessMessage')}
          </Text>
          {sessionId ? (
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
              Session: {sessionId}
            </Text>
          ) : null}
          {resolvedTier ? (
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 6, fontWeight: '700' }}>
              Active tier: {resolvedTier}
            </Text>
          ) : null}
          {syncing ? (
            <View className="mt-4 flex-row items-center">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
                {t('plans.loading')}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('plans.goToPlans')}
            className="mt-4 h-10 items-center justify-center rounded-full px-4"
            style={{ backgroundColor: colors.primary }}
            onPress={() => router.replace('/plans')}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
              {t('plans.goToPlans')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </RequireAuthRoute>
  );
}
