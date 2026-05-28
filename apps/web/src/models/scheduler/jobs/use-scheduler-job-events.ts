import { useCallback, useEffect, useRef } from 'react';

import { CONNECTION, eventBus } from '@/api/events';
import type { EventBusRefreshFn } from '@/lib/refreshable-async-atoms';

/**
 * Subscribe job list to ``scheduler.job.updated`` SSE events (debounced).
 * Also silently refreshes on SSE reconnect after the initial connection.
 */
export function useSchedulerJobEvents(refresh: EventBusRefreshFn, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh({ silent: true });
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const offJob = eventBus.on('scheduler.job.updated', scheduleRefresh);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRefresh();
    });
    return () => {
      offJob();
      offConnected();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);
}
