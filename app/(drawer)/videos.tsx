import { AppScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function VideosScreen() {
  const { t } = useI18n();
  return <AppScreen title={t('drawer.videos')} subtitle={t('screen.videosSubtitle')} />;
}
