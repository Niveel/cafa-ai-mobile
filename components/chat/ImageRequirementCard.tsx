import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { hapticSelection } from '@/utils';

type ImageRequirementCardProps = {
  title: string;
  description: string;
  ctaLabel: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  isDark: boolean;
  colors: {
    primary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };
  onPress: () => void;
};

export function ImageRequirementCard({
  title,
  description,
  ctaLabel,
  iconName = 'image-outline',
  isDark,
  colors,
  onPress,
}: ImageRequirementCardProps) {
  return (
    <View
      className="self-stretch rounded-2xl border px-4 py-3"
      style={{
        width: '100%',
        borderColor: `${colors.primary}66`,
        backgroundColor: isDark ? '#11151E' : '#F6FAFF',
      }}
    >
      <View className="flex-row items-start">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? 'rgba(143, 211, 255, 0.14)' : 'rgba(14, 93, 168, 0.10)' }}
        >
          <Ionicons name={iconName} size={15} color={colors.primary} />
        </View>
        <View className="ml-2.5 flex-1">
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
            {title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            {description}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        onPress={() => {
          hapticSelection();
          onPress();
        }}
        className="mt-3 self-start rounded-full px-4 py-2"
        style={{ backgroundColor: colors.primary }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
          {ctaLabel}
        </Text>
      </Pressable>
    </View>
  );
}
