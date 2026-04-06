import { AppScreen } from '@/components';
import { useI18n } from '@/hooks';

export default function ImagesScreen() {
  const { t } = useI18n();
  return <AppScreen title={t('drawer.images')} subtitle="Browse generated images and image history." />;
}
