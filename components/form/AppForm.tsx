import { ReactNode } from 'react';
import { View } from 'react-native';
import { Formik, FormikConfig, FormikValues } from 'formik';

import { useAppTheme, useI18n } from '@/hooks';
import { FormLoader } from './FormLoader';

type AppFormProps<Values extends FormikValues> = {
  children: ReactNode;
  formStyles?: object;
} & FormikConfig<Values>;

export function AppForm<Values extends FormikValues>({
  initialValues,
  onSubmit,
  validationSchema,
  children,
  formStyles,
  ...rest
}: AppFormProps<Values>) {
  const { isDark } = useAppTheme();
  const { t } = useI18n();

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit} validationSchema={validationSchema} {...rest}>
      {({ isSubmitting }) => (
        <View style={[{ width: '100%', rowGap: 12, position: 'relative' }, formStyles]}>
          {children}
          {isSubmitting ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={t('form.submittingForm')}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 40,
              }}
            >
              <FormLoader />
            </View>
          ) : null}
        </View>
      )}
    </Formik>
  );
}
