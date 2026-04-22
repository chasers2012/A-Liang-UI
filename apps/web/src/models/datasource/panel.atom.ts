import { atom } from 'jotai';

import { listDatasources } from '@/api/datasources';
import type { DataSourcePublic } from './dto';

const datasourcesListRevisionAtom = atom(0);
const datasourcesLoadErrorOverrideAtom = atom<string | null>(null);

const datasourcesListAtom = atom(async (get) => {
  get(datasourcesListRevisionAtom);
  try {
    const items = await listDatasources();
    return { items, error: null as string | null };
  } catch (e) {
    return {
      items: null as DataSourcePublic[] | null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

export const datasourcesItemsAtom = atom(async (get) => (await get(datasourcesListAtom)).items);
export const datasourcesLoadErrorAtom = atom(
  async (get) => {
    const override = get(datasourcesLoadErrorOverrideAtom);
    if (override) return override;
    return (await get(datasourcesListAtom)).error;
  },
  (_get, set, next: string | null) => {
    set(datasourcesLoadErrorOverrideAtom, next);
  },
);
export const datasourcesBusyIdAtom = atom<string | null>(null);
export const datasourcesTestHintAtom = atom<{ id: string; ok: boolean; message: string } | null>(null);
export const datasourcesDeleteTargetAtom = atom<DataSourcePublic | null>(null);
export const datasourcesDeletingAtom = atom<boolean>(false);

export const refreshDatasourcesPanelAtom = atom(null, async (_get, set) => {
  set(datasourcesLoadErrorOverrideAtom, null);
  set(datasourcesListRevisionAtom, (n) => n + 1);
});
