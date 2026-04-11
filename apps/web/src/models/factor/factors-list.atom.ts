import { atom } from "jotai";

import { listFactors } from "@/api";
import type { FactorSummaryPublic } from "./dto";

export type FactorsListState = {
  items: FactorSummaryPublic[] | null;
  error: string | null;
};

export const factorsListAtom = atom<FactorsListState>({
  items: null,
  error: null,
});

/** 首次成功拉取列表后为 true；之后每次刷新列表会 bump 评价概览 revision */
export const factorsListHydratedAtom = atom(false);

export const factorsEvalOverviewRevisionAtom = atom(0);

export const refreshFactorsListAtom = atom(null, async (get, set) => {
  set(factorsListAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listFactors();
    const hydrated = get(factorsListHydratedAtom);
    set(factorsListAtom, { items, error: null });
    if (hydrated) {
      set(factorsEvalOverviewRevisionAtom, (n) => n + 1);
    } else {
      set(factorsListHydratedAtom, true);
    }
  } catch (e) {
    set(factorsListAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

export const bumpFactorsEvalOverviewRevisionAtom = atom(null, (_get, set) => {
  set(factorsEvalOverviewRevisionAtom, (n) => n + 1);
});
