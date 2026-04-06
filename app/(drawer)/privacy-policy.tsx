import { BlankRouteScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function PrivacyPolicyScreen() {
  const { t } = useI18n();
  return <BlankRouteScreen title={t('drawer.userMenu.privacy')} />;
}
