import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getFactor } from '@/api/factors';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { FactorDetailPublic } from './dto';
import { factorsSelectedIdAtom } from './selection.atom';

export const factorsDetailRevisionAtomFamily = atomFamily((key: string) => {
  void key;
  return atom(0);
});

export const factorsDetailAsyncAtomFamily = atomFamily((factorId: string | null) =>
  atom(async (get): Promise<FactorDetailPublic | null> => {
    get(factorsDetailRevisionAtomFamily(factorId ?? ''));
    if (!factorId) return null;
    return await getFactor(factorId);
  }),
);

export const factorsDetailAsyncStateAtomFamily = atomFamily((factorId: string | null) =>
  toAsyncValueStateAtom(factorsDetailAsyncAtomFamily(factorId)),
);

export const factorsDetailAtom = atom((get) => {
  const selectedId = get(factorsSelectedIdAtom);
  return get(factorsDetailAsyncStateAtomFamily(selectedId)).value ?? null;
});

export const factorsDetailLoadingAtom = atom((get) => {
  const selectedId = get(factorsSelectedIdAtom);
  return get(factorsDetailAsyncStateAtomFamily(selectedId)).loading;
});

export const factorsDetailErrorAtom = atom((get) => {
  const selectedId = get(factorsSelectedIdAtom);
  return get(factorsDetailAsyncStateAtomFamily(selectedId)).error;
});

export const refreshFactorsDetailAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set) => {
    set(factorsDetailRevisionAtomFamily(key), (v) => v + 1);
  }),
);
