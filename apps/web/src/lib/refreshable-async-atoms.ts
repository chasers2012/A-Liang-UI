import { atom, type Getter } from 'jotai';
import { withAtomEffect } from 'jotai-effect';

import { toAsyncValueStateAtom } from '@/lib/loadable';

type ValueUpdater<T> = T | ((prev: T) => T);

export function createRefreshableAsyncAtoms<T>(config: { initialValue: T; fetcher: (get: Getter) => Promise<T> }) {
  const revisionAtom = atom(0);

  const asyncBaseAtom = atom(async (get): Promise<T> => {
    get(revisionAtom);
    return await config.fetcher(get);
  });

  const localValueAtom = atom<T>(config.initialValue);

  const asyncAtom = withAtomEffect(asyncBaseAtom, (get, set) => {
    const promise = get(asyncBaseAtom);
    promise.then((value) => {
      set(localValueAtom, value);
    });
  });

  const valueAtom = atom<T, [ValueUpdater<T>], void>(
    (get) => {
      get(asyncAtom);
      return get(localValueAtom);
    },
    (_get, set, update) => {
      set(localValueAtom, update);
    },
  );

  const asyncStateAtom = toAsyncValueStateAtom(asyncAtom);
  const loadingAtom = atom((get) => get(asyncStateAtom).loading);
  const errorAtom = atom((get) => get(asyncStateAtom).error);
  const refreshAtom = atom(null, (_get, set) => {
    set(revisionAtom, (v) => v + 1);
  });

  return {
    valueAtom,
    loadingAtom,
    errorAtom,
    refreshAtom,
  } as const;
}
