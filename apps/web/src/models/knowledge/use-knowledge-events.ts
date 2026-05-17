import { useCallback, useEffect, useRef } from 'react';

import { eventBus, useEventReconnect } from '@/events';

/**
 * Subscribe knowledge page state to SSE events.
 *
 * Replaces the previous 3s polling: ``knowledge.document.updated`` events
 * are debounced into a single ``refresh()``. Also fires on SSE reconnect.
 */
export function useKnowledgeEvents(refresh: () => Promise<unknown> | void, debounceMs = 200) {
  const timerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refresh();
    }, debounceMs);
  }, [debounceMs, refresh]);

  useEffect(() => {
    const off = eventBus.on('knowledge.document.updated', scheduleRefresh);
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
