import { atom, type Getter } from 'jotai';

import { toAsyncValueStateAtom } from '@/lib/loadable';

type ValueUpdater<T> = T | ((prev: T) => T);

export function createRefreshableAsyncAtoms<T>(config: { initialValue: T; fetcher: (get: Getter) => Promise<T> }) {
  const refreshCountAtom = atom(0);

  const asyncAtom = atom(async (get): Promise<T> => {
    get(refreshCountAtom);
    return await config.fetcher(get);
  });

  const asyncStateAtom = toAsyncValueStateAtom(asyncAtom);
  const overwrittenAtom = atom<{ refresh: number; value: T } | null>(null);

  const valueAtom = atom<T, [ValueUpdater<T>], void>(
    (get) => {
      const refresh = get(refreshCountAtom);
      const overwritten = get(overwrittenAtom);
      if (overwritten && overwritten.refresh === refresh) {
        return overwritten.value;
      }
      const asyncState = get(asyncStateAtom);
      return asyncState.value ?? config.initialValue;
    },
    (get, set, update) => {
      const current = get(valueAtom);
      const next = typeof update === 'function' ? (update as (prev: T) => T)(current) : update;
      set(overwrittenAtom, {
        refresh: get(refreshCountAtom),
        value: next,
      });
    },
  );

  const loadingAtom = atom((get) => get(asyncStateAtom).loading);
  const errorAtom = atom((get) => get(asyncStateAtom).error);
  const refreshAtom = atom(null, (_get, set) => {
    set(refreshCountAtom, (v) => v + 1);
  });

  return {
    asyncAtom,
    valueAtom,
    loadingAtom,
    errorAtom,
    refreshAtom,
  } as const;
}
