// App-level bus so the network layer can raise the Upgrade / Top-up sheets from anywhere.
export type StudioGateEvent = 'upgrade_required' | 'insufficient_credits' | 'open_topup' | 'credits_changed';
type Listener = (event: StudioGateEvent) => void;

const listeners = new Set<Listener>();

export function subscribeStudioGate(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStudioGate(event: StudioGateEvent) {
  listeners.forEach((l) => l(event));
}
