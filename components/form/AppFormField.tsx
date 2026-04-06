import type { TextInputProps as RNTextInputProps } from 'react-native';
import { useFormikContext } from 'formik';

import { TextInput } from './TextInput';
import { AppErrorMessage } from './AppErrorMessage';

type StringFieldFormValues = Record<string, string>;

type Props<Values extends StringFieldFormValues = StringFieldFormValues> = {
  name: keyof Values & string;
  label: string;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  required?: boolean;
  placeholder?: string;
} & Pick<RNTextInputProps, 'autoComplete' | 'keyboardType' | 'maxLength' | 'autoCorrect' | 'inputMode'>;

export function AppFormField<Values extends StringFieldFormValues = StringFieldFormValues>({
  name,
  label,
  multiline = false,
  rows = 4,
  type = 'text',
  required = false,
  placeholder,
  autoComplete,
  keyboardType,
  maxLength,
  autoCorrect,
  inputMode,
}: Props<Values>) {
  const { errors, setFieldTouched, setFieldValue, touched, values } = useFormikContext<Values>();

  const error = errors[name] as string;
  const isTouched = touched[name] as boolean;
  const value = values[name];

  return (
    <>
      <TextInput
        type={type}
        name={name}
        label={label}
        multiline={multiline}
        rows={rows}
        onBlur={() => setFieldTouched(name)}
        onChange={(nextValue) => setFieldValue(name, nextValue)}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCorrect={autoCorrect}
        inputMode={inputMode}
      />
      <AppErrorMessage error={error} visible={isTouched} />
    </>
  );
}
