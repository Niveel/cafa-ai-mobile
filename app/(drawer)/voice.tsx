import { AppScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function VoiceScreen() {
  const { t } = useI18n();
  return <AppScreen title={t('drawer.voice')} subtitle={t('screen.voiceSubtitle')} />;
}
