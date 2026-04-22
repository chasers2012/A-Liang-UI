import { atom } from 'jotai';

import { runFactorEvaluation } from '@/api/evaluation-run';

type RunEvaluationActionParams = {
  factorId: string;
  evaluationProfileId: string | null;
  dataSetId: string | null;
};

export const runEvaluationActionAtom = atom(null, async (get, set, params: RunEvaluationActionParams) => {
  const { factorId, evaluationProfileId, dataSetId } = params;
  if (!dataSetId || !evaluationProfileId) {
    return;
  }
  runFactorEvaluation(factorId, { dataSetId, evaluationProfileId });
});
