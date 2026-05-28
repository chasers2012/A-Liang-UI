import { atom, type Getter } from 'jotai';

import { toAsyncValueStateAtom } from '@/lib/loadable';

type ValueUpdater<T> = T | ((prev: T) => T);

export type RefreshableAsyncRefreshOptions = {
  /** 无感刷新：保留上次数据，且不进入 loading 状态 */
  silent?: boolean;
};

/** eventBus 订阅回调使用的刷新函数签名 */
export type EventBusRefreshFn = (options?: RefreshableAsyncRefreshOptions) => void | Promise<unknown>;

export function createRefreshableAsyncAtoms<T>(config: { initialValue: T; fetcher: (get: Getter) => Promise<T> }) {
  const refreshCountAtom = atom(0);
  const silentRefreshAtom = atom(false);
  let inFlightRequest: Promise<T> | null = null;
  let lastResolvedValue: T | null = null;
  let hasResolved = false;

  const asyncAtom = atom(async (get): Promise<T> => {
    get(refreshCountAtom);
    if (inFlightRequest) {
      return await inFlightRequest;
    }
    inFlightRequest = config.fetcher(get);
    try {
      const result = await inFlightRequest;
      lastResolvedValue = result;
      hasResolved = true;
      return result;
    } finally {
      inFlightRequest = null;
    }
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
      if (asyncState.value !== null) {
        return asyncState.value;
      }
      if (get(silentRefreshAtom) && lastResolvedValue !== null) {
        return lastResolvedValue;
      }
      return config.initialValue;
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

  const loadingAtom = atom((get) => {
    const asyncState = get(asyncStateAtom);
    if (get(silentRefreshAtom) && hasResolved) {
      return false;
    }
    return asyncState.loading;
  });
  const errorAtom = atom((get) => get(asyncStateAtom).error);
  const refreshAtom = atom(null, (_get, set, options?: RefreshableAsyncRefreshOptions) => {
    set(silentRefreshAtom, options?.silent ?? false);
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
