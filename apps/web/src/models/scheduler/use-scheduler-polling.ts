import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { schedulerPageAtom } from './list-detail.atom';

export function useSchedulerPolling(refresh: () => void, intervalMs = 3000) {
  const { jobs } = useAtomValue(schedulerPageAtom);
  const hasPendingJobs = useMemo(
    () => Boolean(jobs?.some((job) => ['queued', 'running', 'retrying'].includes(job.status))),
    [jobs],
  );

  useEffect(() => {
    if (!hasPendingJobs) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [hasPendingJobs, intervalMs, refresh]);
}
