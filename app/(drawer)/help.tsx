import { BlankRouteScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function HelpScreen() {
  const { t } = useI18n();
  return <BlankRouteScreen title={t('drawer.userMenu.help')} />;
}
