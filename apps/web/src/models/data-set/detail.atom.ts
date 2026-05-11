import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getDataSet } from '@/api/data-sets';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { DataSetPublic } from '@/models/data-set/dto';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

export const dataSetDetailRevisionAtomFamily = atomFamily((key: string) => {
  void key;
  return atom(0);
});

export const dataSetDetailAsyncAtomFamily = atomFamily((dataSetId: string | null) =>
  atom(async (get): Promise<DataSetPublic | null> => {
    get(dataSetDetailRevisionAtomFamily(dataSetId ?? ''));
    const id = (dataSetId ?? '').trim();
    if (!id) return null;
    return await getDataSet(id);
  }),
);

export const dataSetDetailAsyncStateAtomFamily = atomFamily((dataSetId: string | null) =>
  toAsyncValueStateAtom(dataSetDetailAsyncAtomFamily(dataSetId)),
);

export const refreshDataSetDetailAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set) => {
    set(dataSetDetailRevisionAtomFamily(key), (v) => v + 1);
  }),
);

/** Convenience selector: current selected dataset detail (or null). */
export const selectedDataSetDetailAtom = atom((get) => {
  const selectedId = get(dataSetsSelectedIdAtom);
  const detailState = get(dataSetDetailAsyncStateAtomFamily(selectedId));
  return detailState.value ?? null;
});
