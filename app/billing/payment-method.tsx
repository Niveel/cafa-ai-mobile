import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';

import { RequireAuthRoute, SecondaryNav } from '@/components';
import {
  confirmPaymentMethodUpdate,
  createPaymentMethodSetupIntent,
  getDefaultPaymentMethod,
  type DefaultPaymentMethod,
} from '@/features';
import { useAppTheme } from '@/hooks';

function capitalize(brand: string) {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function PaymentMethodScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<DefaultPaymentMethod>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusText, setStatusText] = useState('');

  const loadPaymentMethod = useCallback(async () => {
    setLoading(true);
    setStatusText('');
    try {
      const pm = await getDefaultPaymentMethod();
      setPaymentMethod(pm);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Could not load payment method.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPaymentMethod();
  }, [loadPaymentMethod]);

  const onUpdate = useCallback(async () => {
    setIsUpdating(true);
    setStatusText('');
    try {
      const { clientSecret } = await createPaymentMethodSetupIntent();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Cafa AI',
        setupIntentClientSecret: clientSecret,
      });
      if (initError) {
        setStatusText(initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          setStatusText(presentError.message);
        }
        return;
      }

      const setupIntentId = clientSecret.split('_secret_')[0];
      await confirmPaymentMethodUpdate(setupIntentId);
      setStatusText('Payment method updated.');
      await loadPaymentMethod();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Could not update payment method.');
    } finally {
      setIsUpdating(false);
    }
  }, [initPaymentSheet, loadPaymentMethod, presentPaymentSheet]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title="Payment Method" topOffset={Math.max(insets.top, 0)} />

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : Platform.OS === 'ios' ? (
          <View className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Manage your payment method through Apple's subscription settings.
            </Text>
          </View>
        ) : (
          <View>
            <View
              className="mt-4 rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F12' : '#FFFFFF' }}
            >
              {paymentMethod ? (
                <>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Card on file</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
                    {capitalize(paymentMethod.brand)} •••• {paymentMethod.last4}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No payment method on file.</Text>
              )}
            </View>

            {!!statusText && (
              <View className="mt-3 rounded-xl border px-3 py-2" style={{ borderColor: colors.border, backgroundColor: isDark ? '#11131A' : '#F8FAFC' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{statusText}</Text>
              </View>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Update payment method"
              disabled={isUpdating}
              onPress={() => {
                void onUpdate();
              }}
              className="mt-4 h-11 items-center justify-center rounded-full px-4"
              style={{ backgroundColor: colors.primary, opacity: isUpdating ? 0.7 : 1 }}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                  {paymentMethod ? 'Update payment method' : 'Add payment method'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </RequireAuthRoute>
  );
}
