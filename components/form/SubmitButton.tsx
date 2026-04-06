import { useFormikContext } from 'formik';

import { AppButton } from '@/components/ui/AppButton';
import { useI18n } from '@/hooks';

type Props = {
  title: string;
  forceEnable?: boolean;
};

export function SubmitButton({ title, forceEnable = false }: Props) {
  const { handleSubmit, isValid, dirty, isSubmitting } = useFormikContext();
  const { t } = useI18n();

  const isDisabled = !(isValid && (dirty || forceEnable)) || isSubmitting;

  return (
    <AppButton
      label={isSubmitting ? t('form.submitting') : title}
      variant="solid"
      onPress={() => {
        if (!isDisabled) handleSubmit();
      }}
      minWidth={140}
      iconName={isSubmitting ? 'sparkles-outline' : 'arrow-forward-outline'}
    />
  );
}
