import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/context';
import { hapticSelection } from '@/utils';

type UpgradePromptCardProps = {
  reason: string;
  feature: string;
  isDark: boolean;
};

// "search_products" -> "Search products". Mirrors ToolStatusChips' humanizeToolName so any
// feature name the backend introduces reads sensibly with no app update required.
function humanizeFeatureName(feature: string) {
  const words = feature.replace(/[_-]+/g, ' ').trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : feature;
}

export function UpgradePromptCard({ reason, feature, isDark }: UpgradePromptCardProps) {
  const { colors, t } = useAppContext();
  const featureLabel = humanizeFeatureName(feature);
  const isRateLimit = reason === 'rate_limit';

  return (
    <View
      className="mt-2 self-stretch rounded-2xl border px-4 py-3"
      style={{
        borderColor: `${colors.warning}66`,
        backgroundColor: isDark ? '#1A1508' : '#FFFBEB',
      }}
    >
      <View className="flex-row items-start">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? 'rgba(249, 199, 15, 0.16)' : 'rgba(249, 199, 15, 0.18)' }}
        >
          <Ionicons name={isRateLimit ? 'time-outline' : 'rocket-outline'} size={15} color={colors.warning} />
        </View>
        <View className="ml-2.5 flex-1">
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
            {t(isRateLimit ? 'chat.upgradePrompt.rateLimitTitle' : 'chat.upgradePrompt.creditsTitle', { feature: featureLabel })}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            {t(isRateLimit ? 'chat.upgradePrompt.rateLimitBody' : 'chat.upgradePrompt.creditsBody', { feature: featureLabel })}
          </Text>
        </View>
      </View>
      {/* Two different remedies (same as web): a plan limit is fixed by
          upgrading (credits don't help); running out of credits is fixed by
          buying a top-up. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(isRateLimit ? 'chat.limit.upgradeCta' : 'chat.limit.buyCreditsCta')}
        onPress={() => {
          hapticSelection();
          router.push(isRateLimit ? '/plans' : '/billing/credits');
        }}
        className="mt-3 self-start rounded-full px-4 py-2"
        style={{ backgroundColor: colors.primary }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
          {t(isRateLimit ? 'chat.limit.upgradeCta' : 'chat.limit.buyCreditsCta')}
        </Text>
      </Pressable>
    </View>
  );
}
