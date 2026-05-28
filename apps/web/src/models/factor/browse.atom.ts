import { atom } from 'jotai';

import { factorsListAtoms } from './list-detail.atom';

export const factorsDefaultSelectedIdAtom = atom((get) => {
  const items = get(factorsListAtoms.valueAtom);
  return items?.[0]?.id ?? null;
});
