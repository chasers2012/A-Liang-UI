import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { listDataSets } from '@/api/data-sets';
import { listEvaluationProfiles } from '@/api/evaluation-profiles';
import { getFactor, getFactorEvaluationsSummary } from '@/api/factors';
import type { DataSetPublic } from '@/models/data-set/dto';
import type { EvaluationProfilePublic } from '../evaluation-profile/dto';
import type { FactorDetailPublic, FactorEvaluationRowPublic, FactorSummaryPublic } from './dto';

export type FactorDetailPageState = {
  loading: boolean;
  loadError: string | null;
  detail: FactorDetailPublic | null;
  evalRow: FactorEvaluationRowPublic | null;
  profiles: EvaluationProfilePublic[];
  dataSets: DataSetPublic[];
  runProfileId: string | null;
  runDataSetId: string | null;
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
    dataSets: [],
    runProfileId: null,
    runDataSetId: null,
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
        loadError: '无效的因子 id',
      });
      return;
    }
    set(factorDetailStateAtomFamily(factorId), (s) => ({
      ...s,
      loadError: null,
      loading: true,
    }));
    try {
      const [d, summary, pr, dataSets] = await Promise.all([
        getFactor(factorId),
        getFactorEvaluationsSummary(),
        listEvaluationProfiles(),
        listDataSets(),
      ]);
      set(factorDetailStateAtomFamily(factorId), (prev) => {
        const runProfileId = (() => {
          const p = prev.runProfileId;
          if (p && pr.some((x) => x.id === p)) return p;
          return pr[0]?.id ?? null;
        })();
        const runDataSetId = (() => {
          const ds = prev.runDataSetId;
          if (ds && dataSets.some((x) => x.id === ds)) return ds;
          return dataSets[0]?.id ?? null;
        })();
        return {
          ...prev,
          loading: false,
          loadError: null,
          detail: d,
          evalRow: summary.rows.find((r) => r.factor_id === factorId) ?? null,
          profiles: pr,
          dataSets,
          runProfileId,
          runDataSetId,
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
