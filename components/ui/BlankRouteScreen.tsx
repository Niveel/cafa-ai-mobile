import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks';
import { SecondaryNav } from './SecondaryNav';

type BlankRouteScreenProps = {
  title: string;
};

export function BlankRouteScreen({ title }: BlankRouteScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
      <SecondaryNav title={title} topOffset={Math.max(insets.top, 0)} />
      <View className="flex-1" />
    </View>
  );
}
