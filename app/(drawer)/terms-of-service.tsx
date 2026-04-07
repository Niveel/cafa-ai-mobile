import { LegalDocumentScreen } from '@/components';
import { TERMS_OF_SERVICE_DOCUMENT } from '@/data';
import { useI18n } from '@/hooks';

export default function TermsOfServiceScreen() {
  const { t } = useI18n();
  return <LegalDocumentScreen title={t('drawer.userMenu.terms')} document={TERMS_OF_SERVICE_DOCUMENT} />;
}
