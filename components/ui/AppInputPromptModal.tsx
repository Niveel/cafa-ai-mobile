import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';

type AppInputPromptModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

export function AppInputPromptModal({
  visible,
  title,
  message,
  initialValue = '',
  confirmLabel,
  cancelLabel,
  placeholder = '',
  onCancel,
  onConfirm,
}: AppInputPromptModalProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const resolvedConfirmLabel = confirmLabel ?? t('common.save');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!visible) return;
    setValue(initialValue);
  }, [initialValue, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View
        className="flex-1 items-center justify-center px-5"
        style={{ backgroundColor: 'rgba(4, 6, 12, 0.58)' }}
      >
        <Pressable onPress={onCancel} style={{ position: 'absolute', inset: 0 }} />
        <View
          className="w-full rounded-3xl p-4"
          style={{
            borderWidth: 1.5,
            borderColor: colors.primary,
            backgroundColor: isDark ? '#101015' : '#FFFFFF',
          }}
        >
          <View className="mb-2 flex-row items-center">
            <View
              className="mr-3 h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.primary}20` }}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 }}>{title}</Text>
          </View>

          {message ? (
            <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 13 }}>
              {message}
            </Text>
          ) : null}

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={title}
            className="rounded-xl border px-3 py-2.5"
            style={{ color: colors.textPrimary, borderColor: colors.border, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' }}
            maxLength={120}
            autoFocus
          />

          <View className="mt-4 flex-row justify-end gap-2">
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={resolvedCancelLabel}
              className="h-10 items-center justify-center rounded-full px-4"
              style={{ borderWidth: 1.5, borderColor: colors.primary }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{resolvedCancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onConfirm(value.trim())}
              accessibilityRole="button"
              accessibilityLabel={resolvedConfirmLabel}
              className="h-10 items-center justify-center rounded-full px-4"
              style={{ backgroundColor: colors.primary }}
              disabled={!value.trim()}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{resolvedConfirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
