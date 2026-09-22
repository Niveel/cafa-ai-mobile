import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';

import { RequireAuthRoute, SecondaryNav } from '@/components';
import {
  createTopupPaymentIntent,
  getCreditsPacks,
  getCreditsStatus,
  invalidateCreditsCache,
  type CreditsPack,
  type CreditsStatus,
} from '@/features';
import { useAppTheme } from '@/hooks';

const MIN_CUSTOM_USD = 1;
const MAX_CUSTOM_USD = 500;

function formatUsd(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatCredits(credits: number) {
  return credits.toLocaleString();
}

export default function CreditsTopupScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CreditsStatus | null>(null);
  const [packs, setPacks] = useState<CreditsPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<CreditsPack['id'] | 'custom' | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [statusText, setStatusText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setStatusText('');
    try {
      const [nextStatus, nextPacks] = await Promise.all([getCreditsStatus(), getCreditsPacks()]);
      setStatus(nextStatus);
      setPacks(nextPacks);
      if (nextPacks.length > 0) setSelectedPackId(nextPacks[0].id);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Could not load credits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const waitForCreditsToLand = useCallback(async (baselineTopupBalance: number) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const next = await getCreditsStatus({ force: true });
        if (next.topupBalance !== baselineTopupBalance) {
          setStatus(next);
          return;
        }
        setStatus(next);
      } catch {
        // keep polling until attempts run out
      }
    }
  }, []);

  const onBuy = useCallback(async () => {
    const customValue = Number(customAmount);
    const isCustom = selectedPackId === 'custom';
    if (isCustom && (!Number.isFinite(customValue) || customValue < MIN_CUSTOM_USD || customValue > MAX_CUSTOM_USD)) {
      setStatusText(`Enter an amount between $${MIN_CUSTOM_USD} and $${MAX_CUSTOM_USD}.`);
      return;
    }
    if (!isCustom && !selectedPackId) return;

    setIsBuying(true);
    setStatusText('');
    try {
      const input = isCustom ? { customAmountUsd: customValue } : { packId: selectedPackId as CreditsPack['id'] };
      const intent = await createTopupPaymentIntent(input);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Cafa AI',
        paymentIntentClientSecret: intent.clientSecret,
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

      setStatusText(`Payment succeeded! Adding ${formatCredits(intent.credits)} credits...`);
      invalidateCreditsCache();
      await waitForCreditsToLand(status?.topupBalance ?? 0);
      setStatusText(`${formatCredits(intent.credits)} credits added.`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Top-up failed. Please try again.');
    } finally {
      setIsBuying(false);
    }
  }, [customAmount, initPaymentSheet, presentPaymentSheet, selectedPackId, status?.topupBalance, waitForCreditsToLand]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title="Buy Credits" topOffset={Math.max(insets.top, 0)} />

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View>
            <View
              className="mt-4 rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F12' : '#FFFFFF' }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Top-up balance</Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                {formatCredits(status?.topupBalance ?? 0)} credits
              </Text>
            </View>

            {Platform.OS === 'ios' ? (
              <View className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Credit top-ups are not available on iOS yet.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 8 }}>
                  Choose a pack
                </Text>
                {packs.map((pack) => {
                  const selected = selectedPackId === pack.id;
                  return (
                    <TouchableOpacity
                      key={pack.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedPackId(pack.id)}
                      className="mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3"
                      style={{
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.06)') : 'transparent',
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                        {formatCredits(pack.credits)} credits
                      </Text>
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                        {formatUsd(pack.priceUsd)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setSelectedPackId('custom')}
                  className="mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3"
                  style={{
                    borderColor: selectedPackId === 'custom' ? colors.primary : colors.border,
                    backgroundColor:
                      selectedPackId === 'custom' ? (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.06)') : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Custom amount</Text>
                  {selectedPackId === 'custom' ? (
                    <TextInput
                      value={customAmount}
                      onChangeText={setCustomAmount}
                      placeholder="$1-500"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', minWidth: 70, textAlign: 'right' }}
                    />
                  ) : (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>$1-500</Text>
                  )}
                </TouchableOpacity>

                {!!statusText && (
                  <View className="mt-3 rounded-xl border px-3 py-2" style={{ borderColor: colors.border, backgroundColor: isDark ? '#11131A' : '#F8FAFC' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{statusText}</Text>
                  </View>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Buy credits"
                  disabled={isBuying || !selectedPackId}
                  onPress={() => {
                    void onBuy();
                  }}
                  className="mt-4 h-11 items-center justify-center rounded-full px-4"
                  style={{ backgroundColor: colors.primary, opacity: isBuying || !selectedPackId ? 0.7 : 1 }}
                >
                  {isBuying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Buy credits</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </RequireAuthRoute>
  );
}
