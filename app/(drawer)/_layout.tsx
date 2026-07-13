import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useAppTheme, useI18n } from '@/hooks';
import { AppDrawerContent } from '@/components/ui/AppDrawerContent';
import { useAppContext } from '@/context';
import { consumeDrawerShouldReopenOnFocus } from '@/services/navigation/drawerRestore';

const drawerIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'chatbubble-ellipses-outline',
  tools: 'grid-outline',
  repo: 'folder-open-outline',
  'avatar-video': 'person-circle-outline',
  images: 'images-outline',
  videos: 'videocam-outline',
  'image-to-video': 'film-outline',
  'edit-image': 'color-wand-outline',
  artifacts: 'document-attach-outline',
  voice: 'mic-outline',
  'cafa-life': 'radio-outline',
  'writing-tools': 'create-outline',
  plans: 'card-outline',
  help: 'help-circle-outline',
  'privacy-policy': 'shield-checkmark-outline',
  'terms-of-service': 'document-text-outline',
};

export default function DrawerLayout() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useAppContext();
  const { t } = useI18n();

  return (
    <Drawer
      drawerContent={(props) =>
        isAuthenticated ? <AppDrawerContent {...props} /> : <View style={{ flex: 1, backgroundColor: colors.surface }} />
      }
      screenListeners={({ route, navigation }) => ({
        focus: () => {
          if (!isAuthenticated) return;
          if (!consumeDrawerShouldReopenOnFocus(route.name)) return;
          requestAnimationFrame(() => {
            navigation.openDrawer();
          });
        },
      })}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textSecondary,
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
        drawerStyle: {
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          borderRightWidth: 1,
          width: isAuthenticated ? 320 : 0,
        },
        drawerIcon: ({ color, size }) => (
          <Ionicons name={drawerIcons[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        ),
      })}
    >
      <Drawer.Screen name="index" options={{ title: t('drawer.newChat') }} />
      <Drawer.Screen name="tools" options={{ title: 'Tools' }} />
      <Drawer.Screen name="repo" options={{ title: 'Repo' }} />
      <Drawer.Screen
        name="images"
        options={{
          title: t('drawer.images'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="videos"
        options={{
          title: t('drawer.videos'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="avatar-video"
        options={{
          title: 'Avatar Video',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="avatar-history"
        options={{
          title: 'Avatar History',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="image-to-video"
        options={{
          title: 'Image-to-video',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="edit-image"
        options={{
          title: 'Edit image',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="artifacts"
        options={{
          title: t('drawer.artifacts'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="voice"
        options={{
          title: 'Text to Speech',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="cafa-life"
        options={{
          title: t('drawer.cafaLife'),
        }}
      />
      <Drawer.Screen
        name="writing-tools"
        options={{
          title: t('drawer.writingTools'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen name="plans" options={{ title: t('drawer.userMenu.upgrade') }} />
      <Drawer.Screen
        name="help"
        options={{
          title: t('drawer.userMenu.help'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="privacy-policy"
        options={{
          title: t('drawer.userMenu.privacy'),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="terms-of-service"
        options={{
          title: t('drawer.userMenu.terms'),
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}
