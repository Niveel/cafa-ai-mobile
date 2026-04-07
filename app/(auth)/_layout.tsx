import { Redirect, Stack, useSegments } from 'expo-router';
import { useAppContext } from '@/context';

export default function AuthLayout() {
  const { isAuthenticated } = useAppContext();
  const segments = useSegments();
  const isOnboardingRoute = (segments as string[]).includes('onboarding');

  if (isAuthenticated && !isOnboardingRoute) {
    return <Redirect href="/(drawer)" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
