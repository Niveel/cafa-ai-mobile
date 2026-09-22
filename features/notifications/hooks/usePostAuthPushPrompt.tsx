import { useCallback, useRef, useState } from 'react';

import { AppPromptModal } from '@/components';
import { getPushPermissionState, isPushSupported, registerForPushNotifications } from '../services/pushRegistration';

/**
 * Real Issue 14 build: a deliberate push-permission prompt shown right after
 * a real, successful login or signup -- Android's official guidance (and
 * this app's own established discipline of never firing an OS permission
 * dialog cold) is to show a real, custom explainer first, then only trigger
 * the actual system dialog if the user opts in. Only fires when permission
 * is still genuinely unasked ('default') -- never re-nags a user who
 * already granted or denied it, and never fires twice in one call site
 * since `maybeShowPrompt` always resolves exactly once.
 */
export function usePostAuthPushPrompt() {
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<(() => void) | null>(null);

  const maybeShowPrompt = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      void (async () => {
        if (!isPushSupported()) {
          resolve();
          return;
        }
        const state = await getPushPermissionState().catch(() => 'default' as const);
        if (state !== 'default') {
          resolve();
          return;
        }
        resolverRef.current = resolve;
        setVisible(true);
      })();
    });
  }, []);

  const settle = useCallback(() => {
    setVisible(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.();
  }, []);

  const handleEnable = useCallback(() => {
    void registerForPushNotifications()
      .catch(() => {})
      .finally(settle);
  }, [settle]);

  const modal = (
    <AppPromptModal
      visible={visible}
      title="Stay in the loop"
      message="Enable notifications so Cafa AI can let you know when a generation finishes and about important account updates."
      confirmLabel="Enable"
      cancelLabel="Not now"
      iconName="notifications-outline"
      onConfirm={handleEnable}
      onCancel={settle}
      onDismiss={settle}
    />
  );

  return { maybeShowPrompt, modal };
}
