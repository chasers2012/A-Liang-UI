import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { backtestsListAtom } from './list-detail.atom';

export function useBacktestsPolling(refresh: () => void, intervalMs = 3000) {
  const { items } = useAtomValue(backtestsListAtom);
  const hasPendingBacktests = useMemo(
    () => Boolean(items?.some((run) => run.status === 'queued' || run.status === 'running')),
    [items],
  );

  useEffect(() => {
    if (!hasPendingBacktests) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [hasPendingBacktests, intervalMs, refresh]);
}
