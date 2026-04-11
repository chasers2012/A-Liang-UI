import { atom } from "jotai";

import { listDatasources } from "@/api";
import type { DataSourcePublic } from "./dto";

export type DatasourcesPanelState = {
  items: DataSourcePublic[] | null;
  loadError: string | null;
  busyId: string | null;
  testHint: { id: string; ok: boolean; message: string } | null;
  deleteTarget: DataSourcePublic | null;
  deleting: boolean;
};

export const datasourcesPanelAtom = atom<DatasourcesPanelState>({
  items: null,
  loadError: null,
  busyId: null,
  testHint: null,
  deleteTarget: null,
  deleting: false,
});

export const refreshDatasourcesPanelAtom = atom(null, async (_get, set) => {
  set(datasourcesPanelAtom, (s) => ({ ...s, loadError: null }));
  try {
    const items = await listDatasources();
    set(datasourcesPanelAtom, (s) => ({ ...s, items, loadError: null }));
  } catch (e) {
    set(datasourcesPanelAtom, (s) => ({
      ...s,
      items: null,
      loadError: e instanceof Error ? e.message : String(e),
    }));
  }
});
