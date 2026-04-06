import { TextInputProps as RNTextInputProps } from 'react-native';

export type AppFormFieldType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

export type AppTextInputProps = {
  name: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  type?: AppFormFieldType;
  iconName?: string;
  iconAria?: string;
  onIconPress?: () => void;
} & Omit<RNTextInputProps, 'onChange' | 'onChangeText' | 'value'>;
