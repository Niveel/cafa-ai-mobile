import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

import { useAppTheme, useI18n } from '@/hooks';

import { MOVIE_STUDIO_TOPUP_ENABLED } from '../config';
import { movieStudioApi } from '../data/api';
import { emitStudioGate } from '../data/events';
import { waitForCreditsToLand } from '../domain/jobs';
import { MAX_CUSTOM_TOPUP_USD, MIN_CUSTOM_TOPUP_USD, formatCredits, parseCustomTopup } from '../domain/rules';
import type { CreditBalance } from '../domain/types';
import { useLatest } from '../hooks/useLatest';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { ICON, useStudioPalette } from '../theme';


const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Props = { visible: boolean; onClose: () => void };
type Step = 'select' | 'confirm' | 'done';
type Intent = { clientSecret: string; amountUsd: number; credits: number };

/**
 * "Buy Movie Studio credits": pick a pack or a custom amount, continue to payment, confirm the credits, pay with the
 * native Stripe PaymentSheet, then wait for the webhook to credit the account (5 x 1.5 s against a pre-payment baseline).
 */
export function TopupSheet({ visible, onClose }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const surface = P.surface;

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await movieStudioApi.getBalance();
      setBalance(b);
      setSelected((current) => current || b.topupPacks[0]?.packId || '');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tRef.current('studio.topup.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tRef]);

  useEffect(() => {
    if (visible && MOVIE_STUDIO_TOPUP_ENABLED) {
      setStep('select');
      setIntent(null);
      setStatus(null);
      void load();
    }
  }, [visible, load]);

  const isCustom = selected === 'custom';
  const customAmount = parseCustomTopup(custom);
  const canContinue = !preparing && !loading && (isCustom ? customAmount !== null : Boolean(selected));

  const continueToPayment = async () => {
    if (!canContinue) return;
    if (isCustom && customAmount === null) {
      setError(t('studio.topup.customInvalid'));
      return;
    }
    setPreparing(true);
    setError(null);
    try {
      setIntent(await movieStudioApi.createTopupIntent(isCustom ? { customAmountUsd: customAmount as number } : { packId: selected }));
      setStep('confirm');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('studio.topup.failed'));
    } finally {
      setPreparing(false);
    }
  };

  const pay = async () => {
    if (!intent || !balance || paying) return;
    setPaying(true);
    setError(null);
    setStatus(null);
    try {
      const init = await initPaymentSheet({ merchantDisplayName: 'Cafa AI', paymentIntentClientSecret: intent.clientSecret });
      if (init.error) throw new Error(init.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code !== 'Canceled') throw new Error(presented.error.message || t('studio.topup.failed'));
        return;
      }
      setStatus(t('studio.topup.processing'));
      // Credits arrive through a Stripe webhook, so poll for the balance to rise above the pre-payment baseline.
      const landed = await waitForCreditsToLand(balance.balance, async () => (await movieStudioApi.getBalance()).balance, sleep);
      setStatus(landed.landed ? t('studio.topup.added', { credits: formatCredits(intent.credits) }) : t('studio.topup.slow'));
      setStep('done');
      emitStudioGate('credits_changed');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('studio.topup.failed'));
    } finally {
      setPaying(false);
    }
  };

  const row = (id: string, title: string, subtitle: string | null, trailing: string) => {
    const on = selected === id;
    return (
      <Pressable
        key={id}
        disabled={preparing}
        onPress={() => setSelected(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        className="mb-2 flex-row items-center rounded-xl border p-3"
        style={{ minHeight: 56, borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}38` : surface }}
      >
        <View
          style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? P.accent : colors.textSecondary, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? P.accent : 'transparent' }}
        >
          {on ? <StudioIcon name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{title}</Text>
          {subtitle ? <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{trailing}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={paying ? undefined : onClose} accessibilityLabel={t('studio.common.close')} />
      <View style={{ backgroundColor: P.sheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' }}>
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8, flex: 1 }}>
            <StudioIcon name="film" size={16} color="#A855F7" />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('studio.topup.sheetTitle')}</Text>
          </View>
          <Pressable
            onPress={onClose}
            disabled={paying}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('studio.common.close')}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <StudioIcon name="x" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {!MOVIE_STUDIO_TOPUP_ENABLED ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('studio.topup.disabled')}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading && !balance ? <ActivityIndicator color={ICON} style={{ marginVertical: 16 }} /> : null}

            {step === 'select' && balance ? (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  {t('studio.topup.balance', { credits: formatCredits(balance.balance) })}
                </Text>
                {balance.nextExpiring ? (
                  <Text style={{ color: '#D97706', fontSize: 12, marginBottom: 8 }}>
                    {t('studio.topup.expiring', {
                      credits: formatCredits(balance.nextExpiring.credits),
                      date: new Date(balance.nextExpiring.expiresAt).toLocaleDateString(),
                    })}
                  </Text>
                ) : null}
                <View style={{ marginTop: 6 }}>
                  {balance.topupPacks.map((p) => row(p.packId, t('studio.topup.packLabel', { credits: formatCredits(p.credits) }), null, `$${p.priceUsd}`))}
                  {row('custom', t('studio.topup.custom'), `$${MIN_CUSTOM_TOPUP_USD} – $${MAX_CUSTOM_TOPUP_USD}`, '')}
                </View>
                {isCustom ? (
                  <TextInput
                    value={custom}
                    onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    editable={!preparing}
                    placeholder={t('studio.topup.customPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    className="mb-2 rounded-xl border px-3"
                    style={{ borderColor: P.border, color: colors.textPrimary, backgroundColor: surface, height: 44 }}
                  />
                ) : null}
              </>
            ) : null}

            {step === 'confirm' && intent ? (
              <View className="rounded-xl border p-4" style={{ borderColor: P.border, backgroundColor: surface }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{`$${intent.amountUsd}`}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  {t('studio.topup.youGet', { credits: formatCredits(intent.credits) })}
                </Text>
              </View>
            ) : null}

            {status ? (
              <View className="my-2 flex-row items-center" style={{ gap: 6 }}>
                <StudioIcon name={step === 'done' ? 'circle-check' : 'loader-circle'} size={16} color="#16A34A" />
                <Text style={{ color: '#16A34A', fontSize: 12, flex: 1 }}>{status}</Text>
              </View>
            ) : null}
            {error ? (
              <View className="my-2 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
                <View style={{ marginTop: 2 }}>
                  <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
                </View>
                <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            <View className="mb-2 mt-3 flex-row flex-wrap" style={{ gap: 10 }}>
              {step === 'select' ? (
                <StudioButton
                  label={t('studio.topup.continue')}
                  icon="arrow-right"
                  iconAfter
                  loading={preparing}
                  loadingLabel={t('studio.topup.preparing')}
                  disabled={!canContinue}
                  onPress={() => void continueToPayment()}
                />
              ) : null}
              {step === 'confirm' ? (
                <>
                  <StudioButton label={t('studio.topup.back')} icon="arrow-left" variant="outline" disabled={paying} onPress={() => setStep('select')} />
                  <StudioButton label={t('studio.topup.payNow')} loading={paying} loadingLabel={t('studio.topup.processingButton')} onPress={() => void pay()} />
                </>
              ) : null}
              {step === 'done' ? <StudioButton label={t('studio.topup.done')} onPress={onClose} /> : null}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
