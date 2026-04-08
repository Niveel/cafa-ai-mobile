import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { usePathname, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PostHogProvider, usePostHog } from 'posthog-react-native';

import '../global.css';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { useAppTheme } from '@/hooks';

const FALLBACK_POSTHOG_API_KEY = 'phc_wLqwjYh7S5KECBfZNzo75UYYTUHdrEvRHTXYPkxTicae';
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || FALLBACK_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!process.env.EXPO_PUBLIC_POSTHOG_API_KEY) {
  // Keep this visible in device logs to avoid silent analytics outages in build profiles
  // where EXPO_PUBLIC env injection is missing.
  console.warn('[analytics] EXPO_PUBLIC_POSTHOG_API_KEY is missing. Falling back to bundled PostHog key.');
}

function PostHogScreenTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const segments = useSegments();
  const lastTrackedRef = useRef('');

  useEffect(() => {
    if (!pathname) return;
    const screenName = pathname === '/' ? 'home' : pathname.replace(/^\//, '');
    if (screenName === lastTrackedRef.current) return;
    lastTrackedRef.current = screenName;
    posthog.screen(screenName, {
      path: pathname,
      segments: segments.join('/'),
    });
  }, [pathname, posthog, segments]);

  return null;
}

function AppNavigator() {
  const { isDark, colors } = useAppTheme();
  const { isReady: appIsReady } = useAppContext();

  if (!appIsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PostHogScreenTracker />
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
