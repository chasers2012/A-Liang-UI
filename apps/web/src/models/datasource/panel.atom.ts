import { atom } from 'jotai';

import { deleteDatasource, listDatasources } from '@/api/datasources';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { DataSourcePublic } from './dto';

export const datasourcesListAtoms = createRefreshableAsyncAtoms<DataSourcePublic[] | null>({
  initialValue: null,
  fetcher: listDatasources,
});

export const datasourcesBusyIdAtom = atom<string | null>(null);
export const datasourcesTestHintAtom = atom<{ id: string; ok: boolean; message: string } | null>(null);
export const datasourcesDeleteTargetAtom = atom<DataSourcePublic | null>(null);
export const datasourcesDeletingAtom = atom<boolean>(false);
export const datasourcesDeleteErrorAtom = atom<string | null>(null);

export const confirmDeleteDatasourceAtom = atom(null, async (get, set) => {
  const target = get(datasourcesDeleteTargetAtom);
  if (!target) return;
  set(datasourcesDeletingAtom, true);
  set(datasourcesDeleteErrorAtom, null);
  try {
    await deleteDatasource(target.id);
    set(datasourcesDeleteTargetAtom, null);
    await set(datasourcesListAtoms.refreshAtom);
  } catch (e) {
    set(datasourcesDeleteErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(datasourcesDeletingAtom, false);
  }
});
