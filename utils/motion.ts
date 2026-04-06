import * as Haptics from 'expo-haptics';

export const MOTION = {
  duration: {
    quick: 120,
    normal: 220,
    slow: 320,
  },
  spring: {
    soft: { damping: 16, stiffness: 180, mass: 0.9 },
    snappy: { damping: 14, stiffness: 240, mass: 0.75 },
  },
} as const;

let lastHapticAt = 0;

function shouldSkipHaptic() {
  const now = Date.now();
  if (now - lastHapticAt < 45) return true;
  lastHapticAt = now;
  return false;
}

export function hapticSelection() {
  if (shouldSkipHaptic()) return;
  void Haptics.selectionAsync();
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (shouldSkipHaptic()) return;
  void Haptics.impactAsync(style);
}

export function hapticNotify(type: Haptics.NotificationFeedbackType) {
  if (shouldSkipHaptic()) return;
  void Haptics.notificationAsync(type);
}

export function hapticSuccess() {
  hapticNotify(Haptics.NotificationFeedbackType.Success);
}

export function hapticError() {
  hapticNotify(Haptics.NotificationFeedbackType.Error);
}
