import * as Haptics from 'expo-haptics';

type AnimationLevel = 'full' | 'reduced' | 'off';

const BASE_DURATION = {
  quick: 120,
  normal: 220,
  slow: 320,
};

let hapticsEnabled = true;
let animationLevel: AnimationLevel = 'full';

function motionScale() {
  if (animationLevel === 'off') return 0;
  if (animationLevel === 'reduced') return 0.55;
  return 1;
}

function scaledDuration(base: number) {
  const scaled = Math.round(base * motionScale());
  return Math.max(0, scaled);
}

export const MOTION = {
  duration: {
    get quick() {
      return scaledDuration(BASE_DURATION.quick);
    },
    get normal() {
      return scaledDuration(BASE_DURATION.normal);
    },
    get slow() {
      return scaledDuration(BASE_DURATION.slow);
    },
  },
  spring: {
    get soft() {
      if (animationLevel === 'off') return { damping: 100, stiffness: 1000, mass: 1 };
      if (animationLevel === 'reduced') return { damping: 20, stiffness: 260, mass: 0.8 };
      return { damping: 16, stiffness: 180, mass: 0.9 };
    },
    get snappy() {
      if (animationLevel === 'off') return { damping: 100, stiffness: 1000, mass: 1 };
      if (animationLevel === 'reduced') return { damping: 18, stiffness: 320, mass: 0.7 };
      return { damping: 14, stiffness: 240, mass: 0.75 };
    },
  },
};

let lastHapticAt = 0;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function setAnimationLevel(level: AnimationLevel) {
  animationLevel = level;
}

function shouldSkipHaptic() {
  if (!hapticsEnabled) return true;
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
