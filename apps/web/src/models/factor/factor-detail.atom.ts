import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import {
  getFactor,
  getFactorEvaluationsSummary,
  listEvaluationMetrics,
  listEvaluationProfiles,
} from "@/lib/quant-agent-api";
import type { EvaluationMetricSummaryPublic } from "../evaluation-metric/dto";
import type { EvaluationProfilePublic } from "../evaluation-profile/dto";
import type {
  FactorDetailPublic,
  FactorEvaluationRowPublic,
  FactorSummaryPublic,
} from "./dto";

export type FactorDetailPageState = {
  loading: boolean;
  loadError: string | null;
  detail: FactorDetailPublic | null;
  evalRow: FactorEvaluationRowPublic | null;
  profiles: EvaluationProfilePublic[];
  evaluationMetrics: EvaluationMetricSummaryPublic[];
  runProfileId: string | null;
  deleteTarget: FactorSummaryPublic | null;
  deleting: boolean;
};

function initialFactorDetailState(): FactorDetailPageState {
  return {
    loading: true,
    loadError: null,
    detail: null,
    evalRow: null,
    profiles: [],
    evaluationMetrics: [],
    runProfileId: null,
    deleteTarget: null,
    deleting: false,
  };
}

export const factorDetailStateAtomFamily = atomFamily((factorId: string) => {
  void factorId;
  return atom<FactorDetailPageState>(initialFactorDetailState());
});

export const loadFactorDetailAtomFamily = atomFamily((factorId: string) =>
  atom(null, async (_get, set) => {
    if (!factorId) {
      set(factorDetailStateAtomFamily(factorId), {
        ...initialFactorDetailState(),
        loading: false,
        loadError: "无效的因子 id",
      });
      return;
    }
    set(factorDetailStateAtomFamily(factorId), (s) => ({
      ...s,
      loadError: null,
      loading: true,
    }));
    try {
      const [d, summary, pr, metrics] = await Promise.all([
        getFactor(factorId),
        getFactorEvaluationsSummary(),
        listEvaluationProfiles(),
        listEvaluationMetrics(),
      ]);
      set(factorDetailStateAtomFamily(factorId), (prev) => {
        const runProfileId = (() => {
          const p = prev.runProfileId;
          if (p && pr.some((x) => x.id === p)) return p;
          const defp = pr.find((p0) => p0.is_default);
          return defp ? defp.id : null;
        })();
        return {
          ...prev,
          loading: false,
          loadError: null,
          detail: d,
          evalRow: summary.rows.find((r) => r.factor_id === factorId) ?? null,
          profiles: pr,
          evaluationMetrics: metrics,
          runProfileId,
        };
      });
    } catch (e) {
      set(factorDetailStateAtomFamily(factorId), {
        ...initialFactorDetailState(),
        loading: false,
        loadError: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);

export const refreshFactorEvalRowAtomFamily = atomFamily((factorId: string) =>
  atom(null, async (_get, set) => {
    if (!factorId) return;
    const summary = await getFactorEvaluationsSummary();
    set(factorDetailStateAtomFamily(factorId), (s) => ({
      ...s,
      evalRow: summary.rows.find((r) => r.factor_id === factorId) ?? null,
    }));
  }),
);
