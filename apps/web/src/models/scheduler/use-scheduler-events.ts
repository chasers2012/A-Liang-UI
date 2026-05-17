import { useCallback, useEffect, useRef } from 'react';

import { CONNECTION, eventBus } from '@/events';

/**
 * Subscribe scheduler page state to SSE events.
 *
 * Replaces the previous 3s polling: when ``scheduler.job.updated`` or
 * ``scheduler.task.updated`` arrives we coalesce within a short window and
 * issue a single ``refresh()``. The same refresh is fired on SSE reconnect
 * to re-align after a drop.
 */
export function useSchedulerEvents(refresh: () => Promise<unknown> | void, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh();
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const offJob = eventBus.on('scheduler.job.updated', scheduleRefresh);
    const offTask = eventBus.on('scheduler.task.updated', scheduleRefresh);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRefresh();
    });
    return () => {
      offJob();
      offTask();
      offConnected();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);
}
