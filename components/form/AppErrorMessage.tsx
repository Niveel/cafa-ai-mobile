import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  error?: string;
  visible?: boolean;
};

export function AppErrorMessage({ error, visible }: Props) {
  if (!error || !visible) return null;

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start rounded-lg border px-3 py-2"
      style={{ borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(254, 242, 242, 1)' }}
    >
      <Ionicons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginTop: 1 }} />
      <Text style={{ color: '#B91C1C', marginLeft: 8, fontSize: 12, fontWeight: '600', flex: 1 }}>{error}</Text>
    </View>
  );
}
