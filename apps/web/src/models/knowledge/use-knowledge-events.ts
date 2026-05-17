import { useCallback, useEffect, useRef } from 'react';

import { CONNECTION, eventBus } from '@/api/events';

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
    const offTopic = eventBus.on('knowledge.document.updated', scheduleRefresh);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRefresh();
    });
    return () => {
      offTopic();
      offConnected();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);
}
