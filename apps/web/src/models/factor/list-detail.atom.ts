import { atom } from 'jotai';

import { listFactors } from '@/api/factors';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { FactorSummaryPublic } from './dto';

const factorsListRevisionAtom = atom(0);

const factorsListAsyncAtom = atom(async (get): Promise<FactorSummaryPublic[]> => {
  get(factorsListRevisionAtom);
  return await listFactors();
});

const factorsListAsyncStateAtom = toAsyncValueStateAtom(factorsListAsyncAtom);

export const factorsListAtom = atom((get): FactorSummaryPublic[] | null => {
  return get(factorsListAsyncStateAtom).value;
});

export const factorsListLoadingAtom = atom((get) => get(factorsListAsyncStateAtom).loading);

export const factorsListErrorAtom = atom((get) => get(factorsListAsyncStateAtom).error);

export const refreshFactorsListAtom = atom(null, (_get, set) => {
  set(factorsListRevisionAtom, (v) => v + 1);
});
