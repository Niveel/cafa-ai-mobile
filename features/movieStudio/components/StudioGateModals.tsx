import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { AppPromptModal } from '@/components/ui/AppPromptModal';
import { useI18n } from '@/hooks';

import { emitStudioGate } from '../data/events';
import { useStudioGates } from '../hooks/useStudioGates';
import { StudioIcon } from './StudioIcon';
import { TopupSheet } from './TopupSheet';

/**
 * Mount once per Studio screen. Reacts to the data layer's upgrade / insufficient-credits / open-top-up
 * events. Drawer screens stay mounted, so only the focused screen renders the dialogs (no duplicates).
 */
export function StudioGateModals() {
  const { t } = useI18n();
  const focused = useIsFocused();
  const { gate, dismiss } = useStudioGates(focused);

  if (!focused) return null;

  return (
    <>
      <AppPromptModal
        visible={gate === 'upgrade_required'}
        icon={
          <LinearGradient
            colors={['#2B4F8E', '#204079']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <StudioIcon name="film" size={20} color="#FFFFFF" />
          </LinearGradient>
        }
        iconBackground="transparent"
        title={t('studio.upgrade.title')}
        message={t('studio.upgrade.message')}
        confirmLabel={t('studio.upgrade.viewPlans')}
        cancelLabel={t('studio.upgrade.later')}
        onConfirm={() => {
          dismiss();
          router.push('/(drawer)/plans');
        }}
        onCancel={dismiss}
        onDismiss={dismiss}
      />
      <AppPromptModal
        visible={gate === 'insufficient_credits'}
        icon={<StudioIcon name="coins" size={20} color="#F59E0B" />}
        iconBackground="#F59E0B22"
        title={t('studio.topup.title')}
        message={t('studio.topup.message')}
        confirmLabel={t('studio.topup.action')}
        cancelLabel={t('studio.common.cancel')}
        onConfirm={() => {
          dismiss();
          emitStudioGate('open_topup');
        }}
        onCancel={dismiss}
        onDismiss={dismiss}
      />
      <TopupSheet visible={gate === 'open_topup'} onClose={dismiss} />
    </>
  );
}
