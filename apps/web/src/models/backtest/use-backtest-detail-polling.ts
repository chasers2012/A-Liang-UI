import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { backtestDetailAtomFamily } from './list-detail.atom';

export function useBacktestDetailPolling(runId: string, refresh: () => void, intervalMs = 3000) {
  const { run } = useAtomValue(backtestDetailAtomFamily(runId));
  const isPending = useMemo(() => run?.status === 'queued' || run?.status === 'running', [run?.status]);

  useEffect(() => {
    if (!runId || !isPending) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, isPending, refresh, runId]);
}
