type Listener = () => void;

export function createStore<T extends object>(initialState: T) {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getState = () => state;

  const setState = (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
    const nextPartial = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...nextPartial };
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    getState,
    setState,
    subscribe,
  };
}
