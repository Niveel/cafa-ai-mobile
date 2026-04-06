import { BlankRouteScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function PlansScreen() {
  const { t } = useI18n();
  return <BlankRouteScreen title={t('drawer.userMenu.upgrade')} />;
}
