import { atom } from 'jotai';

import { getFactorTemplate } from '@/api/factors';
import { toAsyncValueStateAtom } from '@/lib/loadable';

const factorTemplateRevisionAtom = atom(0);

export const factorTemplateAsyncAtom = atom(async (get): Promise<string> => {
  get(factorTemplateRevisionAtom);
  return await getFactorTemplate();
});

const factorTemplateAsyncStateAtom = toAsyncValueStateAtom(factorTemplateAsyncAtom);

export const factorTemplateAtom = atom((get) => get(factorTemplateAsyncStateAtom).value ?? null);

export const factorTemplateLoadingAtom = atom((get) => get(factorTemplateAsyncStateAtom).loading);

export const factorTemplateErrorAtom = atom((get) => get(factorTemplateAsyncStateAtom).error);

export const refreshFactorTemplateAtom = atom(null, (_get, set) => {
  set(factorTemplateRevisionAtom, (v) => v + 1);
});
