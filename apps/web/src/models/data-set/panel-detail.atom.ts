import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getDataSet, listDataSets } from '@/api/data-sets';
import type { DataSetPublic } from './dto';

export type DataSetsPanelState = {
  items: DataSetPublic[] | null;
  loadError: string | null;
  deleteTarget: DataSetPublic | null;
  deleting: boolean;
};

export const dataSetsPanelAtom = atom<DataSetsPanelState>({
  items: null,
  loadError: null,
  deleteTarget: null,
  deleting: false,
});

export const refreshDataSetsPanelAtom = atom(null, async (_get, set) => {
  set(dataSetsPanelAtom, (s) => ({ ...s, loadError: null }));
  try {
    const items = await listDataSets();
    set(dataSetsPanelAtom, (s) => ({ ...s, items, loadError: null }));
  } catch (e) {
    set(dataSetsPanelAtom, (s) => ({
      ...s,
      items: null,
      loadError: e instanceof Error ? e.message : String(e),
    }));
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
