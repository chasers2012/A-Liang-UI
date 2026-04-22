import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getDataSet, listDataSets } from '@/api/data-sets';
import type { DataSetPublic } from './dto';

const dataSetsListRevisionAtom = atom(0);
const dataSetsLoadErrorOverrideAtom = atom<string | null>(null);

const dataSetsListAtom = atom(async (get) => {
  get(dataSetsListRevisionAtom);
  try {
    const items = await listDataSets();
    return { items, error: null as string | null };
  } catch (e) {
    return { items: null as DataSetPublic[] | null, error: e instanceof Error ? e.message : String(e) };
  }
});

export const dataSetsItemsAtom = atom(async (get) => (await get(dataSetsListAtom)).items);
export const dataSetsLoadErrorAtom = atom(
  async (get) => {
    const override = get(dataSetsLoadErrorOverrideAtom);
    if (override) return override;
    return (await get(dataSetsListAtom)).error;
  },
  (_get, set, next: string | null) => {
    set(dataSetsLoadErrorOverrideAtom, next);
  },
);
export const dataSetsDeleteTargetAtom = atom<DataSetPublic | null>(null);
export const dataSetsDeletingAtom = atom<boolean>(false);

export const refreshDataSetsAtom = atom(null, async (_get, set) => {
  set(dataSetsLoadErrorOverrideAtom, null);
  set(dataSetsListRevisionAtom, (n) => n + 1);
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
