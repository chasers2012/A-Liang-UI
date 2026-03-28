import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import {
  getEvaluationTestSet,
  listEvaluationTestSets,
} from "@/lib/quant-agent-api";
import type { EvaluationTestSetPublic } from "./dto";

export type TestSetsPanelState = {
  items: EvaluationTestSetPublic[] | null;
  loadError: string | null;
  deleteTarget: EvaluationTestSetPublic | null;
  deleting: boolean;
};

export const testSetsPanelAtom = atom<TestSetsPanelState>({
  items: null,
  loadError: null,
  deleteTarget: null,
  deleting: false,
});

export const refreshTestSetsPanelAtom = atom(null, async (_get, set) => {
  set(testSetsPanelAtom, (s) => ({ ...s, loadError: null }));
  try {
    const items = await listEvaluationTestSets();
    set(testSetsPanelAtom, (s) => ({ ...s, items, loadError: null }));
  } catch (e) {
    set(testSetsPanelAtom, (s) => ({
      ...s,
      items: null,
      loadError: e instanceof Error ? e.message : String(e),
    }));
  }
});

export type TestSetDetailState = {
  row: EvaluationTestSetPublic | null;
  error: string | null;
  loading: boolean;
  deleteOpen: boolean;
  deleting: boolean;
};

function initialTestSetDetail(): TestSetDetailState {
  return {
    row: null,
    error: null,
    loading: true,
    deleteOpen: false,
    deleting: false,
  };
}

export const testSetDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<TestSetDetailState>(initialTestSetDetail());
});

export const loadTestSetDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) {
      set(testSetDetailAtomFamily(id), {
        ...initialTestSetDetail(),
        loading: false,
        error: "无效的测试集 id",
      });
      return;
    }
    set(testSetDetailAtomFamily(id), (s) => ({
      ...s,
      error: null,
      loading: true,
    }));
    try {
      const row = await getEvaluationTestSet(id);
      set(testSetDetailAtomFamily(id), (s) => ({
        ...s,
        row,
        loading: false,
        error: null,
      }));
    } catch (e) {
      set(testSetDetailAtomFamily(id), (s) => ({
        ...s,
        row: null,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }),
);
