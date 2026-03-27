import { atom } from "jotai";
import { atomFamily } from "jotai/utils";

import { getDatasource } from "@/lib/quant-agent-api";
import type { DataSourcePublic } from "./dto";

export type DatasourceDetailState = {
  ds: DataSourcePublic | null;
  error: string | null;
  loading: boolean;
  busy: boolean;
  testHint: { ok: boolean; message: string } | null;
  deleteOpen: boolean;
  deleting: boolean;
};

function initialDatasourceDetail(): DatasourceDetailState {
  return {
    ds: null,
    error: null,
    loading: true,
    busy: false,
    testHint: null,
    deleteOpen: false,
    deleting: false,
  };
}

export const datasourceDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<DatasourceDetailState>(initialDatasourceDetail());
});

export const loadDatasourceDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) {
      set(datasourceDetailAtomFamily(id), {
        ...initialDatasourceDetail(),
        loading: false,
        error: "无效的 id",
      });
      return;
    }
    set(datasourceDetailAtomFamily(id), (s) => ({
      ...s,
      error: null,
      loading: true,
    }));
    try {
      const ds = await getDatasource(id);
      set(datasourceDetailAtomFamily(id), (s) => ({
        ...s,
        ds,
        loading: false,
        error: null,
      }));
    } catch (e) {
      set(datasourceDetailAtomFamily(id), (s) => ({
        ...s,
        ds: null,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }),
);
