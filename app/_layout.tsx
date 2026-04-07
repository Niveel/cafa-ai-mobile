import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';

import '../global.css';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { useAppTheme } from '@/hooks';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

function AppNavigator() {
  const { isDark, colors } = useAppTheme();
  const { isReady: appIsReady } = useAppContext();

  if (!appIsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(drawer)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const appTree = (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {POSTHOG_API_KEY ? (
        <PostHogProvider apiKey={POSTHOG_API_KEY} options={{ host: POSTHOG_HOST }}>
          {appTree}
        </PostHogProvider>
      ) : (
        appTree
      )}
    </GestureHandlerRootView>
  );
}
