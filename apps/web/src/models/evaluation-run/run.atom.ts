import { atom } from 'jotai';

import { runFactorEvaluation } from '@/api/evaluation-run';

export type EvaluationRunRunning = {
  factorId: string;
  factorName?: string;
};

export const evaluationRunRunningAtom = atom<EvaluationRunRunning | null>(null);

type RunEvaluationActionParams = {
  factorId: string;
  factorName?: string;
  evaluationProfileId: string | null;
  dataSetId: string | null;
};

export const runEvaluationActionAtom = atom(null, async (get, set, params: RunEvaluationActionParams) => {
  const { factorId, evaluationProfileId, dataSetId } = params;
  if (!dataSetId || !evaluationProfileId) {
    return;
  }
  set(evaluationRunRunningAtom, { factorId, factorName: params.factorName });
  runFactorEvaluation(factorId, { dataSetId, evaluationProfileId });
});
