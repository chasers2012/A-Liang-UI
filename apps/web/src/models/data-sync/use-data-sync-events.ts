import { useCallback, useEffect, useRef } from 'react';

import { CONNECTION, eventBus, type EventHandler } from '@/api/events';
import type { EventBusRefreshFn } from '@/lib/refreshable-async-atoms';
import { DATASOURCE_SYNC_TASK_TYPE } from '@/models/data-sync/dto';
import { schedulerJobTaskId, schedulerJobTaskType, type SchedulerJobPublic } from '@/models/scheduler/jobs/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/tasks/dto';

type SchedulerTaskEventPayload = SchedulerTaskPublic & { deleted?: boolean };

/**
 * Subscribe the data-sync task list to ``scheduler.task.updated`` (debounced).
 * Also refreshes on SSE reconnect after the initial connection.
 */
export function useDataSyncTaskEvents(refresh: EventBusRefreshFn, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh({ silent: true });
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const onTask: EventHandler<SchedulerTaskEventPayload> = (payload) => {
      if (payload.task_type !== DATASOURCE_SYNC_TASK_TYPE) return;
      scheduleRefresh();
    };
    const offTask = eventBus.on('scheduler.task.updated', onTask);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRefresh();
    });
    return () => {
      offTask();
      offConnected();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);
}

export interface UseDataSyncJobEventsOptions {
  /** When false, no SSE subscriptions are registered. */
  enabled?: boolean;
  /** When set, only jobs for this sync task trigger ``refresh``. */
  taskId?: string | null;
}

/**
 * Subscribe data-sync job views to ``scheduler.job.updated`` (debounced).
 * Also refreshes on SSE reconnect after the initial connection.
 */
export function useDataSyncJobEvents(
  refresh: EventBusRefreshFn,
  options?: UseDataSyncJobEventsOptions,
  debounceMs = 200,
) {
  const { enabled = true, taskId = null } = options ?? {};
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh({ silent: true });
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    if (!enabled || taskId == null) return;

    const onJob: EventHandler<SchedulerJobPublic> = (payload) => {
      if (schedulerJobTaskType(payload) !== DATASOURCE_SYNC_TASK_TYPE) return;
      if (schedulerJobTaskId(payload) !== taskId) return;
      scheduleRefresh();
    };
    const offJob = eventBus.on('scheduler.job.updated', onJob);
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
  }, [enabled, taskId, scheduleRefresh]);
}
