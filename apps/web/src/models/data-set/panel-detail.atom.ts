import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getDataSet, listDataSets } from '@/api/data-sets';
import type { DataSetPublic } from './dto';

export const dataSetsItemsAtom = atom<DataSetPublic[] | null>(null);
export const dataSetsLoadErrorAtom = atom<string | null>(null);
export const dataSetsDeleteTargetAtom = atom<DataSetPublic | null>(null);
export const dataSetsDeletingAtom = atom<boolean>(false);

export const refreshDataSetsAtom = atom(null, async (_get, set) => {
  set(dataSetsLoadErrorAtom, null);
  try {
    const items = await listDataSets();
    set(dataSetsItemsAtom, items);
    set(dataSetsLoadErrorAtom, null);
  } catch (e) {
    set(dataSetsItemsAtom, null);
    set(dataSetsLoadErrorAtom, e instanceof Error ? e.message : String(e));
  }
});

export type DataSetDetailState = {
  row: DataSetPublic | null;
  error: string | null;
  loading: boolean;
  deleteOpen: boolean;
  deleting: boolean;
};

function initialDataSetDetail(): DataSetDetailState {
  return {
    row: null,
    error: null,
    loading: true,
    deleteOpen: false,
    deleting: false,
  };
}

export const dataSetDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<DataSetDetailState>(initialDataSetDetail());
});

export const loadDataSetDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) {
      set(dataSetDetailAtomFamily(id), {
        ...initialDataSetDetail(),
        loading: false,
        error: '无效的数据集 id',
      });
      return;
    }
    set(dataSetDetailAtomFamily(id), (s) => ({
      ...s,
      error: null,
      loading: true,
    }));
    try {
      const row = await getDataSet(id);
      set(dataSetDetailAtomFamily(id), (s) => ({
        ...s,
        row,
        loading: false,
        error: null,
      }));
    } catch (e) {
      set(dataSetDetailAtomFamily(id), (s) => ({
        ...s,
        row: null,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }),
);
