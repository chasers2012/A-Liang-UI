import { atom } from 'jotai';

import { getFactorEvaluationsSummary } from '@/api/factors';
import type { FactorEvaluationsSummaryPublic } from './dto';

export type FactorEvaluationsOverviewState = {
  data: FactorEvaluationsSummaryPublic | null;
  loading: boolean;
  error: string | null;
};

export const factorEvaluationsOverviewStateAtom = atom<FactorEvaluationsOverviewState>({
  data: null,
  loading: true,
  error: null,
});

export const loadFactorEvaluationsOverviewAtom = atom(null, async (_get, set) => {
  set(factorEvaluationsOverviewStateAtom, (s) => ({
    ...s,
    error: null,
    loading: true,
  }));
  try {
    const data = await getFactorEvaluationsSummary();
    set(factorEvaluationsOverviewStateAtom, {
      data,
      loading: false,
      error: null,
    });
  } catch (e) {
    set(factorEvaluationsOverviewStateAtom, {
      data: null,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
