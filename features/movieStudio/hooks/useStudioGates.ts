import { useEffect, useState } from 'react';

import { subscribeStudioGate, type StudioGateEvent } from '../data/events';

export type StudioGate = Exclude<StudioGateEvent, 'credits_changed'>;

/** Latest upgrade / top-up request raised anywhere; call dismiss() to clear it. */
export function useStudioGates(active = true) {
  const [gate, setGate] = useState<StudioGate | null>(null);
  useEffect(() => {
    if (!active) {
      setGate(null);
      return;
    }
    return subscribeStudioGate((event) => {
      if (event !== 'credits_changed') setGate(event);
    });
  }, [active]);
  return { gate, dismiss: () => setGate(null) };
}
