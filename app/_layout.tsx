import { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Animated, AppState, Easing, Image, Linking, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider, usePostHog } from 'posthog-react-native';

import '../global.css';
import { AppPromptModal } from '@/components';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { RevenueCatProvider } from '@/context/RevenueCatContext';
import { checkStoreUpdate } from '@/features';
import { useAppTheme } from '@/hooks';

const FALLBACK_POSTHOG_API_KEY = 'phc_wLqwjYh7S5KECBfZNzo75UYYTUHdrEvRHTXYPkxTicae';
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || FALLBACK_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const SESSION_REPLAY_SAMPLE_RATE = Number(process.env.EXPO_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE ?? '1');
const SPLASH_DARK_BACKGROUND = '#10264D';
const SPLASH_LIGHT_BACKGROUND = '#ffffff';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: splash may already be controlled by native startup flow.
});

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
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [storeUpdateUrl, setStoreUpdateUrl] = useState<string | null>(null);
  const [latestStoreVersion, setLatestStoreVersion] = useState<string | null>(null);
  const isCheckingForStoreUpdateRef = useRef(false);

  useEffect(() => {
    if (!appIsReady) return;

    const runCheck = async () => {
      if (isCheckingForStoreUpdateRef.current) return;
      isCheckingForStoreUpdateRef.current = true;
      try {
        const result = await checkStoreUpdate();
        if (result.hasUpdate) {
          setStoreUpdateUrl(result.storeUrl);
          setLatestStoreVersion(result.latestVersion);
          setUpdateModalVisible(true);
          return;
        }
        setUpdateModalVisible(false);
      } finally {
        isCheckingForStoreUpdateRef.current = false;
      }
    };

    void runCheck();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void runCheck();
    });
    return () => sub.remove();
  }, [appIsReady]);

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
      <AppPromptModal
        visible={updateModalVisible}
        title="Update available"
        message={
          latestStoreVersion
            ? `A newer app version (${latestStoreVersion}) is available. Please update for the best experience.`
            : 'A newer app version is available. Please update for the best experience.'
        }
        confirmLabel="Update now"
        cancelLabel="Later"
        iconName="cloud-download-outline"
        onCancel={() => setUpdateModalVisible(false)}
        onConfirm={() => {
          if (storeUpdateUrl) {
            void Linking.openURL(storeUpdateUrl);
          }
          setUpdateModalVisible(false);
        }}
      />
    </>
  );
}

function AnimatedIntro({ onDone }: { onDone: () => void }) {
  const systemColorScheme = useColorScheme();
  const isDarkSystem = systemColorScheme === 'dark';
  const introOpacity = useRef(new Animated.Value(1)).current;
  const logoProgress = useRef(new Animated.Value(0)).current;
  const danceTilt = useRef(new Animated.Value(0)).current;
  const dancePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await SplashScreen.hideAsync().catch(() => {
        // No-op: safe fallback if already hidden.
      });

      Animated.timing(logoProgress, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      const danceLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(danceTilt, {
              toValue: 1,
              duration: 120,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(danceTilt, {
              toValue: -1,
              duration: 120,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(danceTilt, {
              toValue: 0.75,
              duration: 110,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(danceTilt, {
              toValue: 0,
              duration: 110,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dancePulse, {
              toValue: 1,
              duration: 210,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(dancePulse, {
              toValue: 0,
              duration: 210,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );

      danceLoop.start();

      Animated.sequence([
        Animated.delay(1180),
        Animated.timing(introOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        danceLoop.stop();
        if (!cancelled && finished) onDone();
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [dancePulse, danceTilt, introOpacity, logoProgress, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: isDarkSystem ? SPLASH_DARK_BACKGROUND : SPLASH_LIGHT_BACKGROUND,
        opacity: introOpacity,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <Animated.View
        style={{
          opacity: logoProgress,
          transform: [
            {
              scale: logoProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.78, 1],
              }),
            },
            {
              scale: dancePulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
              }),
            },
            {
              translateY: logoProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
            {
              translateY: dancePulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -6],
              }),
            },
            {
              rotate: danceTilt.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ['-9deg', '0deg', '9deg'],
              }),
            },
          ],
        }}
      >
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 132, height: 132, borderRadius: 28 }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [showAnimatedIntro, setShowAnimatedIntro] = useState(true);
  const appTree = (
    <AppProvider>
      <RevenueCatProvider>
        <AppNavigator />
      </RevenueCatProvider>
    </AppProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {POSTHOG_API_KEY ? (
        <PostHogProvider
          apiKey={POSTHOG_API_KEY}
          options={{
            host: POSTHOG_HOST,
            captureAppLifecycleEvents: true,
            enableSessionReplay: true,
            sessionReplayConfig: {
              sampleRate: Number.isFinite(SESSION_REPLAY_SAMPLE_RATE) ? Math.max(0, Math.min(1, SESSION_REPLAY_SAMPLE_RATE)) : 1,
            },
            errorTracking: {
              autocapture: {
                uncaughtExceptions: true,
                unhandledRejections: true,
                console: ['error'],
              },
            },
          }}
        >
          {appTree}
        </PostHogProvider>
      ) : (
        appTree
      )}
      {showAnimatedIntro ? <AnimatedIntro onDone={() => setShowAnimatedIntro(false)} /> : null}
    </GestureHandlerRootView>
  );
}
