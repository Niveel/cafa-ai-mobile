import { useState } from 'react';
import { Pressable, Text, TextInput as RNTextInput, TextInputProps as RNTextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';

type Props = {
  name: string;
  label: string;
  value?: string;
  onChange?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  iconName?: keyof typeof Ionicons.glyphMap;
  iconAria?: string;
  onIconPress?: () => void;
} & Omit<RNTextInputProps, 'value' | 'onChangeText' | 'multiline'>;

export function TextInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 4,
  required = false,
  type = 'text',
  iconName,
  iconAria,
  onIconPress,
  ...otherProps
}: Props) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordField = !multiline && type === 'password';
  const secureTextEntry = isPasswordField && !showPassword;
  const hasRightControl = Boolean(iconName) || isPasswordField;
  const minHeight = multiline ? Math.max(42, rows * 20) : 44;

  return (
    <View>
      <Text style={{ color: colors.textPrimary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>
        {label}
        {required ? <Text style={{ color: colors.primary }}> *</Text> : null}
      </Text>

      <View
        className="relative rounded-xl border"
        style={{
          borderColor: colors.primary,
          backgroundColor: colors.surface,
        }}
      >
        <RNTextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={type === 'email' ? 'none' : otherProps.autoCapitalize}
          keyboardType={type === 'number' ? 'numeric' : type === 'email' ? 'email-address' : otherProps.keyboardType}
          style={{
            minHeight,
            color: colors.textPrimary,
            fontSize: 14,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 10 : 9,
            paddingRight: hasRightControl ? 42 : 12,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
          accessibilityLabel={label}
          {...otherProps}
        />

        {isPasswordField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? t('form.hidePassword') : t('form.showPassword')}
            onPress={() => setShowPassword((prev) => !prev)}
            className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {iconName && !isPasswordField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={iconAria || t('form.inputAction')}
            onPress={onIconPress}
            className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
          >
            <Ionicons name={iconName} size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
