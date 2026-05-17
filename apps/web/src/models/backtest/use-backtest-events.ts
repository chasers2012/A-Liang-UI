import { useCallback, useEffect, useRef } from 'react';

import { eventBus, useEventReconnect } from '@/events';

/**
 * Subscribe the backtests list to SSE events.
 *
 * Replaces the previous 3s polling: ``backtest.run.updated`` events are
 * debounced into a single ``refresh()``. Also fires on SSE reconnect.
 */
export function useBacktestEvents(refresh: () => Promise<unknown> | void, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh();
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const off = eventBus.on('backtest.run.updated', scheduleRefresh);
    return () => {
      off();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);

  useEventReconnect(
    useCallback(() => {
      scheduleRefresh();
    }, [scheduleRefresh]),
  );
}
