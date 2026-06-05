import { Platform } from 'react-native';

import { LegalDocumentScreen } from '@/components';
import { getTermsOfServiceDocument } from '@/data';
import { useI18n } from '@/hooks';

export default function TermsOfServiceScreen() {
  const { t } = useI18n();
  return (
    <LegalDocumentScreen
      title={t('drawer.userMenu.terms')}
      document={getTermsOfServiceDocument(Platform.OS)}
    />
  );
}
