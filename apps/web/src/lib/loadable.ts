import { Atom, atom } from 'jotai';
import { loadable } from 'jotai/utils';

export type AsyncValueState<T> = {
  loading: boolean;
  value: T | null;
  error: string | null;
};

export function toAsyncValueStateAtom<T>(baseAtom: Atom<Promise<T>>) {
  const loadableAtom = loadable(baseAtom);
  return atom((get): AsyncValueState<T> => {
    const v = get(loadableAtom);
    if (v.state === 'loading') return { loading: true, value: null, error: null };
    if (v.state === 'hasError')
      return {
        loading: false,
        value: null,
        error: v.error instanceof Error ? v.error.message : String(v.error),
      };
    return { loading: false, value: v.data, error: null };
  });
}
