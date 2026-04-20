import { useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { usePolling } from '@/hooks/use-polling';

import { backtestsListAtom } from './list-detail.atom';

export function useBacktestsPolling(refresh: () => Promise<unknown> | void, intervalMs = 3000) {
  const { items } = useAtomValue(backtestsListAtom);
  const hasPendingBacktests = useMemo(
    () => Boolean(items?.some((run) => run.status === 'queued' || run.status === 'running')),
    [items],
  );

  usePolling(refresh, hasPendingBacktests, intervalMs);
}
