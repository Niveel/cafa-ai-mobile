import { Redirect, Stack } from 'expo-router';
import { useAppContext } from '@/context';

export default function AuthLayout() {
  const { isAuthenticated } = useAppContext();

  if (isAuthenticated) {
    return <Redirect href="/(drawer)" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
