import { Redirect } from 'expo-router';
import { useAppContext } from '@/context';

export default function IndexScreen() {
  const { hasCompletedOnboarding } = useAppContext();

  if (!hasCompletedOnboarding) {
    return <Redirect href={'/(auth)/onboarding' as never} />;
  }

  return <Redirect href="/(drawer)" />;
}
