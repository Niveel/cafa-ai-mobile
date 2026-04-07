import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';

type SecondaryNavProps = {
  title: string;
  onBackPress?: () => void;
  topOffset?: number;
};

export function SecondaryNav({ title, onBackPress, topOffset = 0 }: SecondaryNavProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();

  return (
    <View
      accessibilityRole="header"
      className="flex-row items-center"
      style={{ paddingTop: topOffset + 8, paddingBottom: 8 }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('nav.backFrom', { title })}
        accessibilityHint={t('nav.backHint')}
        onPress={onBackPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.8}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(124,58,237,0.26)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.08)',
        }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text
        className="ml-3 text-xl font-semibold"
        style={{ color: colors.textPrimary }}
        numberOfLines={1}
        accessibilityRole="text"
      >
        {title}
      </Text>
    </View>
  );
}
