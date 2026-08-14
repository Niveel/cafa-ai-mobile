import { Platform } from 'react-native';
import { LegalDocumentScreen } from '@/components';
import { getPrivacyPolicyDocument } from '@/data';
import { useI18n } from '@/hooks';

export default function PrivacyPolicyScreen() {
  const { t } = useI18n();
  return (
    <LegalDocumentScreen
      title={t('drawer.userMenu.privacy')}
      document={getPrivacyPolicyDocument(Platform.OS)}
    />
  );
}
