import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { useAppContext } from '@/context';

type RequireAuthRouteProps = {
  children: ReactNode;
};

export function RequireAuthRoute({ children }: RequireAuthRouteProps) {
  const { isAuthenticated, isReady } = useAppContext();

  if (!isReady) return null;
  if (!isAuthenticated) {
    return <Redirect href="/(drawer)" />;
  }

  return <>{children}</>;
}

