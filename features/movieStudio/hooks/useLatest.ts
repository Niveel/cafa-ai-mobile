import { useRef } from 'react';

/** Always-current value for callbacks/effects that must not re-run when it changes (e.g. the i18n `t`, which is re-created with the app context). */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
