import { useEffect, useRef, useState } from 'react';
import { Stack, useNavigationContainerRef, usePathname, useSegments } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Animated, AppState, Easing, Image, Linking, Platform, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import * as Sentry from '@sentry/react-native';

import '../global.css';
import { AppPromptModal } from '@/components';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { RevenueCatProvider } from '@/context/RevenueCatContext';
import { checkStoreUpdate, ensureCafaLifeGlobalsRegistered } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { bindPostHogClient, screenEvent } from '@/lib/analytics/posthog';
import { initializeTikTokEvents, setTikTokTrackingConsent } from '@/services/tiktokEvents';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const SESSION_REPLAY_SAMPLE_RATE = Number(process.env.EXPO_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE ?? '1');
const FALLBACK_SENTRY_DSN = 'https://e12548e44ab1ad61ccc745d909996c23@o4510828002148352.ingest.us.sentry.io/4511350711451648';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || FALLBACK_SENTRY_DSN;
const SPLASH_DARK_BACKGROUND = '#10264D';
const SPLASH_LIGHT_BACKGROUND = '#ffffff';
const IS_EXPO_GO = isRunningInExpoGo();
const IS_DEV_RUNTIME = __DEV__;

const sentryNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !IS_EXPO_GO,
});

Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: IS_DEV_RUNTIME ? 1.0 : 0.2,
  profilesSampleRate: (IS_EXPO_GO || IS_DEV_RUNTIME) ? 0 : 1.0,
  replaysOnErrorSampleRate: (IS_EXPO_GO || IS_DEV_RUNTIME) ? 0 : 1.0,
  replaysSessionSampleRate: (IS_EXPO_GO || IS_DEV_RUNTIME) ? 0 : 0.1,
  enableLogs: true,
  integrations: [
    sentryNavigationIntegration,
    ...((IS_EXPO_GO || IS_DEV_RUNTIME) ? [] : [Sentry.mobileReplayIntegration()]),
  ],
  enableNativeFramesTracking: !IS_EXPO_GO,
  environment: __DEV__ ? 'development' : 'production',
});

void SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: splash may already be controlled by native startup flow.
});

if (!process.env.EXPO_PUBLIC_POSTHOG_API_KEY) {
  console.warn('[analytics] EXPO_PUBLIC_POSTHOG_API_KEY is missing. PostHog is disabled.');
}

function PostHogBridge() {
  const posthog = usePostHog();

  useEffect(() => {
    bindPostHogClient(posthog);
    return () => bindPostHogClient(null);
  }, [posthog]);

  return null;
}

function PostHogScreenTracker() {
  const pathname = usePathname();
  const segments = useSegments();
  const lastTrackedRef = useRef('');

  useEffect(() => {
    if (!pathname) return;
    const screenName = pathname === '/' ? 'home' : pathname.replace(/^\//, '');
    if (screenName === lastTrackedRef.current) return;
    lastTrackedRef.current = screenName;
    screenEvent(screenName, {
      path: pathname,
      segments: segments.join('/'),
    });
  }, [pathname, segments]);

  return null;
}

function AppNavigator() {
  const { isDark, colors } = useAppTheme();
  const { t } = useI18n();
  const { isReady: appIsReady } = useAppContext();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [storeUpdateUrl, setStoreUpdateUrl] = useState<string | null>(null);
  const [latestStoreVersion, setLatestStoreVersion] = useState<string | null>(null);
  const [tiktokConsentVisible, setTikTokConsentVisible] = useState(false);
  const isCheckingForStoreUpdateRef = useRef(false);

  useEffect(() => {
    if (!appIsReady) return;

    try {
      ensureCafaLifeGlobalsRegistered();
    } catch {
      // Safe no-op: Cafa Live can still surface a native-build requirement on its own screen.
    }

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

  useEffect(() => {
    if (!appIsReady || Platform.OS !== 'android') return;
    void initializeTikTokEvents()
      .then((consent) => setTikTokConsentVisible(consent === null))
      .catch((error) => {
        if (__DEV__) console.warn('[tiktok-events:init]', error);
      });
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
        visible={tiktokConsentVisible}
        title="Allow personalized ad measurement?"
        message="Cafa AI can share app activity, such as registration and subscription events, with TikTok to measure ads and improve campaigns. We do not send your chats, prompts, generated media, email address, or payment details."
        confirmLabel="Allow"
        cancelLabel="Not now"
        iconName="analytics-outline"
        onCancel={() => {
          setTikTokConsentVisible(false);
          void setTikTokTrackingConsent(false);
        }}
        onConfirm={() => {
          setTikTokConsentVisible(false);
          void setTikTokTrackingConsent(true);
        }}
      />
      <AppPromptModal
        visible={updateModalVisible}
        title={t('update.title')}
        message={
          latestStoreVersion
            ? t('update.messageWithVersion', { version: latestStoreVersion })
            : t('update.message')
        }
        confirmLabel={t('update.confirm')}
        cancelLabel={t('update.later')}
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

function RootLayout() {
  const [showAnimatedIntro, setShowAnimatedIntro] = useState(true);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) {
      sentryNavigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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
          <PostHogBridge />
          {appTree}
        </PostHogProvider>
      ) : (
        appTree
      )}
      {showAnimatedIntro ? <AnimatedIntro onDone={() => setShowAnimatedIntro(false)} /> : null}
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
