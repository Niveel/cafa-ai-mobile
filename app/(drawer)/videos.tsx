import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuthRoute, SecondaryNav } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';

export default function VideosScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title={t('drawer.videos')} topOffset={Math.max(insets.top, 0)} />
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 6 }}>
          {t('screen.videosSubtitle')}
        </Text>
      </View>
    </RequireAuthRoute>
  );
}
