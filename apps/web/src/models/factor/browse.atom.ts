import { atom } from 'jotai';

import { factorsListAtoms } from './list-detail.atom';

export type FactorsBrowseState = {
  searchQuery: string;
};

export const factorsBrowseStateAtom = atom<FactorsBrowseState>({
  searchQuery: '',
});

export const setFactorsSearchQueryAtom = atom(null, (_get, set, searchQuery: string) => {
  set(factorsBrowseStateAtom, (s) => ({ ...s, searchQuery }));
});

export const filteredFactorsAtom = atom((get) => {
  const items = get(factorsListAtoms.valueAtom);
  if (!items) return null;
  const q = get(factorsBrowseStateAtom).searchQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((m) => [m.name, m.description, m.group, m.id].join(' ').toLowerCase().includes(q));
});

export const factorsDefaultSelectedIdAtom = atom((get) => {
  const items = get(filteredFactorsAtom);
  return items?.[0]?.id ?? null;
});
