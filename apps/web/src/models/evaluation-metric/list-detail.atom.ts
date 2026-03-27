import { atom } from "jotai";
import { atomFamily } from "jotai/utils";

import {
  getEvaluationMetric,
  listEvaluationMetrics,
} from "@/lib/quant-agent-api";
import type {
  EvaluationMetricDetailPublic,
  EvaluationMetricSummaryPublic,
} from "./dto";

export type EvaluationMetricsListState = {
  items: EvaluationMetricSummaryPublic[] | null;
  error: string | null;
};

export const evaluationMetricsListAtom = atom<EvaluationMetricsListState>({
  items: null,
  error: null,
});

export const refreshEvaluationMetricsListAtom = atom(null, async (_get, set) => {
  set(evaluationMetricsListAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listEvaluationMetrics();
    set(evaluationMetricsListAtom, { items, error: null });
  } catch (e) {
    set(evaluationMetricsListAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

export type EvaluationMetricDetailState = {
  row: EvaluationMetricDetailPublic | null;
  error: string | null;
};

export const evaluationMetricDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<EvaluationMetricDetailState>({ row: null, error: null });
});

export const loadEvaluationMetricDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(evaluationMetricDetailAtomFamily(id), { row: null, error: null });
    try {
      const row = await getEvaluationMetric(id);
      set(evaluationMetricDetailAtomFamily(id), { row, error: null });
    } catch (e) {
      set(evaluationMetricDetailAtomFamily(id), {
        row: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);
