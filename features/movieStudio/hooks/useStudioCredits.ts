import { useCallback, useEffect, useState } from 'react';

import { movieStudioApi } from '../data/api';
import { subscribeStudioGate } from '../data/events';

/** Movie Studio credit balance for the header chip: null while loading or if the request failed ("Credits"). */
export function useStudioCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    movieStudioApi
      .getBalance()
      .then((b) => setCredits(b.balance))
      .catch(() => setCredits(null));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeStudioGate((event) => {
      if (event === 'credits_changed') refresh();
    });
  }, [refresh]);

  return { credits, refresh };
}
