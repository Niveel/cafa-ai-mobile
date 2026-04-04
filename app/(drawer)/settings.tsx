import { AppScreen, AppSwitch } from '@/components';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/hooks';

export default function SettingsTab() {
  const { isDark, colors, toggleThemeMode } = useAppTheme();

  return (
    <AppScreen title="Settings" subtitle="Manage your app experience.">
      <View
        className="rounded-2xl border px-4 py-4"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
              Dark mode
            </Text>
            <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
              Switch between light and dark appearance.
            </Text>
          </View>
          <AppSwitch
            value={isDark}
            onValueChange={toggleThemeMode}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            accessibilityLabel="Dark mode"
            accessibilityHint="Switch app appearance between light and dark mode."
            accessibilityState={{ checked: isDark }}
          />
        </View>
      </View>
    </AppScreen>
  );
}
