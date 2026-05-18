import { useCallback, useEffect, useRef } from 'react';

import { CONNECTION, eventBus, type EventHandler } from '@/api/events';
import type { EventBusRefreshFn } from '@/lib/refreshable-async-atoms';
import { BACKTEST_RUN_TASK_TYPE } from '@/models/backtest/dto';
import { schedulerJobTaskType, type SchedulerJobPublic } from '@/models/scheduler/jobs/dto';

/**
 * Subscribe the backtests list to SSE events.
 *
 * Listens to ``backtest.run.updated`` and ``scheduler.job.updated`` (``backtest.run``
 * jobs). Events are debounced into a single silent ``refresh()``. Also fires on SSE reconnect.
 */
export function useBacktestEvents(refresh: EventBusRefreshFn, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh({ silent: true });
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const onJob: EventHandler<SchedulerJobPublic> = (payload) => {
      if (schedulerJobTaskType(payload) !== BACKTEST_RUN_TASK_TYPE) return;
      scheduleRefresh();
    };
    const offRun = eventBus.on('backtest.run.updated', scheduleRefresh);
    const offJob = eventBus.on('scheduler.job.updated', onJob);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRefresh();
    });
    return () => {
      offRun();
      offJob();
      offConnected();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);
}
