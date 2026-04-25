import { useEffect, type DependencyList } from 'react';

/**
 * Runs `effect` on a microtask after mount / dependency changes.
 * Defers work so loaders that call setState at the start are not synchronous
 * inside the effect body (react-hooks/set-state-in-effect).
 */
export function useEffectMicrotask(effect: () => void | Promise<void>, deps: DependencyList): void {
  useEffect(() => {
    queueMicrotask(() => {
      void effect();
    });
    // Caller supplies the full dependency list (same contract as useEffect).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps parameter mirrors useEffect(deps)
  }, deps);
}
