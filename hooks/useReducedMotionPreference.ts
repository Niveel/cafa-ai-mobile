import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setPrefersReducedMotion(enabled);
      })
      .catch(() => {
        if (mounted) setPrefersReducedMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setPrefersReducedMotion(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return prefersReducedMotion;
}
