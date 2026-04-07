import { LegalDocumentScreen } from '@/components';
import { PRIVACY_POLICY_DOCUMENT } from '@/data';
import { useI18n } from '@/hooks';

export default function PrivacyPolicyScreen() {
  const { t } = useI18n();
  return <LegalDocumentScreen title={t('drawer.userMenu.privacy')} document={PRIVACY_POLICY_DOCUMENT} />;
}
