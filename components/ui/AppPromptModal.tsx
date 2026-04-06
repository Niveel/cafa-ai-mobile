import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks';
import { MOTION, hapticImpact } from '@/utils';

type AppPromptModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmTone?: 'primary' | 'danger';
  iconName?: keyof typeof Ionicons.glyphMap;
};

export function AppPromptModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmTone = 'primary',
  iconName = 'help-circle-outline',
}: AppPromptModalProps) {
  const { colors, isDark } = useAppTheme();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!visible) return;
    hapticImpact();

    overlayAnim.setValue(0);
    cardAnim.setValue(0.96);

    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: MOTION.duration.normal,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim, {
        toValue: 1,
        friction: 8,
        tension: 95,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardAnim, overlayAnim, visible]);

  const confirmBackground = confirmTone === 'danger' ? '#E11D48' : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: overlayAnim,
          backgroundColor: 'rgba(4, 6, 12, 0.58)',
          justifyContent: 'center',
          paddingHorizontal: 18,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close confirmation dialog"
          onPress={onCancel}
          style={{ position: 'absolute', inset: 0 }}
        />

        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            transform: [{ scale: cardAnim }],
            borderWidth: 1.5,
            borderColor: colors.primary,
            borderRadius: 24,
            backgroundColor: isDark ? '#101015' : '#FFFFFF',
            padding: 18,
            shadowColor: '#000000',
            shadowOpacity: isDark ? 0.5 : 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View className="mb-3 flex-row items-center">
            <View
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.primary}24` }}
            >
              <Ionicons name={iconName} size={20} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 }}>
              {title}
            </Text>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
            {message}
          </Text>

          <View className="mt-5 flex-row justify-end gap-2">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={() => {
                hapticImpact();
                onCancel();
              }}
              activeOpacity={0.88}
              className="h-10 items-center justify-center rounded-full px-4"
              style={{
                borderWidth: 1.5,
                borderColor: colors.primary,
                backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={() => {
                hapticImpact();
                onConfirm();
              }}
              activeOpacity={0.88}
              className="h-10 items-center justify-center rounded-full px-4"
              style={{ backgroundColor: confirmBackground }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
