import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks';
import { AppDrawerContent } from '@/components/ui/AppDrawerContent';
import { useAppContext } from '@/context';

const drawerIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'chatbubble-ellipses-outline',
  images: 'images-outline',
  videos: 'videocam-outline',
  voice: 'mic-outline',
  plans: 'card-outline',
  help: 'help-circle-outline',
  'privacy-policy': 'shield-checkmark-outline',
  'terms-of-service': 'document-text-outline',
};

export default function DrawerLayout() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAppContext();

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textSecondary,
        drawerStyle: {
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          borderRightWidth: 1,
          width: 320,
        },
        drawerLabelStyle: {
          marginLeft: -6,
          fontSize: 16,
        },
        drawerItemStyle: {
          minHeight: 52,
          borderRadius: 12,
          marginHorizontal: 10,
        },
        swipeEnabled: isAuthenticated,
        swipeEdgeWidth: 80,
        drawerType: 'slide',
        overlayColor: 'transparent',
        drawerIcon: ({ color, size }) => (
          <Ionicons name={drawerIcons[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        ),
      })}
    >
      <Drawer.Screen name="index" options={{ title: 'Chat' }} />
      <Drawer.Screen name="images" options={{ title: 'Images' }} />
      <Drawer.Screen name="videos" options={{ title: 'Videos' }} />
      <Drawer.Screen name="voice" options={{ title: 'Voice' }} />
      <Drawer.Screen name="plans" options={{ title: 'Plans' }} />
      <Drawer.Screen
        name="help"
        options={{
          title: 'Help',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="privacy-policy"
        options={{
          title: 'Privacy Policy',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="terms-of-service"
        options={{
          title: 'Terms of Service',
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}
