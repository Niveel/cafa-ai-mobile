import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '../global.css';
import { AppProvider } from '@/context/AppContext';
import { useAppTheme } from '@/hooks';
import { setupAuthInterceptor } from '@/services';

function AppNavigator() {
  const { isDark, colors } = useAppTheme();

  useEffect(() => {
    setupAuthInterceptor();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(drawer)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
