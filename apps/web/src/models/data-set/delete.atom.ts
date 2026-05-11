import { atom } from 'jotai';

import { deleteDataSet } from '@/api/data-sets';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { dataSetsAfterDeletedAtom } from '@/models/data-set/panel-ui.atom';

export type DataSetDeleteState = {
  deleting: boolean;
  error: string | null;
};

export const dataSetDeleteStateAtom = atom<DataSetDeleteState>({ deleting: false, error: null });

export const confirmDeleteDataSetAtom = atom(null, async (_get, set, dataSetId: string) => {
  const id = (dataSetId ?? '').trim();
  if (!id) return false;

  set(dataSetDeleteStateAtom, { deleting: true, error: null });
  try {
    await deleteDataSet(id);
    set(dataSetAtoms.refreshAtom);
    set(dataSetsAfterDeletedAtom);
    set(dataSetDeleteStateAtom, { deleting: false, error: null });
    return true;
  } catch (e) {
    set(dataSetDeleteStateAtom, { deleting: false, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
});
