import { useEffect, useRef } from 'react';

export function usePolling(callback: () => Promise<unknown> | void, shouldPoll: boolean, intervalMs = 3000) {
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      timerRef.current = window.setTimeout(async () => {
        if (runningRef.current) {
          scheduleNext();
          return;
        }
        runningRef.current = true;
        try {
          await Promise.resolve(callback());
        } catch {
          // ignore polling errors
        } finally {
          runningRef.current = false;
          scheduleNext();
        }
      }, intervalMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callback, intervalMs, shouldPoll]);
}
