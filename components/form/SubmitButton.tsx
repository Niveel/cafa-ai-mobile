import { useFormikContext } from 'formik';

import { AppButton } from '@/components/ui/AppButton';

type Props = {
  title: string;
  forceEnable?: boolean;
};

export function SubmitButton({ title, forceEnable = false }: Props) {
  const { handleSubmit, isValid, dirty, isSubmitting } = useFormikContext();

  const isDisabled = !(isValid && (dirty || forceEnable)) || isSubmitting;

  return (
    <AppButton
      label={isSubmitting ? 'Submitting...' : title}
      variant="solid"
      onPress={() => {
        if (!isDisabled) handleSubmit();
      }}
      minWidth={140}
      iconName={isSubmitting ? 'sparkles-outline' : 'arrow-forward-outline'}
    />
  );
}
