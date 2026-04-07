import { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuthRoute, SecondaryNav } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import { clearPendingBillingTier } from '@/services';

export default function BillingCancelScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void clearPendingBillingTier();
  }, []);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title={t('plans.billingCancelTitle')} topOffset={Math.max(insets.top, 0)} />
        <View className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
            {t('plans.billingCancelTitle')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
            {t('plans.billingCancelMessage')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('plans.goToPlans')}
            className="mt-4 h-10 items-center justify-center rounded-full px-4"
            style={{ borderWidth: 1.2, borderColor: colors.primary }}
            onPress={() => router.replace('/plans')}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              {t('plans.goToPlans')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </RequireAuthRoute>
  );
}
