import { atom } from 'jotai';

import type { FactorEvaluationRowPublic } from '@/models/factor/dto';
import { runFactorEvaluation } from '@/api/evaluation-run';

export type EvaluationRunRunning = {
  factorId: string;
  factorName: string;
};

type RunEvaluationActionParams = {
  factorId: string;
  factorName: string;
  evaluationProfileId: string | null;
  dataSetId: string | null;
  setLoadError?: (message: string | null) => void;
  onSucceeded?: (row: FactorEvaluationRowPublic) => Promise<void> | void;
};

export const evaluationRunRunningAtom = atom<EvaluationRunRunning | null>(null);

function validateRunParams(params: RunEvaluationActionParams): { profileId: string; dataSetId: string } | null {
  const profileId = params.evaluationProfileId?.trim();
  if (!profileId) {
    params.setLoadError?.('暂无可用评价方案，请先创建评价方案后再运行评价。');
    return null;
  }

  const dataSetId = params.dataSetId?.trim();
  if (!dataSetId) {
    params.setLoadError?.('暂无可用数据集，请先创建数据集后再运行评价。');
    return null;
  }

  return { profileId, dataSetId };
}

function canStartRun(running: EvaluationRunRunning | null, params: RunEvaluationActionParams): boolean {
  if (!running) return true;
  if (running.factorId !== params.factorId) {
    params.setLoadError?.(`已有因子「${running.factorName}」正在评价，请等待完成后再试。`);
    return false;
  }
  return false;
}

export const runEvaluationActionAtom = atom(null, async (get, set, params: RunEvaluationActionParams) => {
  const running = get(evaluationRunRunningAtom);
  if (!canStartRun(running, params)) {
    return;
  }

  const validated = validateRunParams(params);
  if (!validated) {
    return;
  }
  const { profileId, dataSetId } = validated;

  set(evaluationRunRunningAtom, { factorId: params.factorId, factorName: params.factorName });
  params.setLoadError?.(null);
  try {
    const row = await runFactorEvaluation(params.factorId, { dataSetId, evaluationProfileId: profileId });
    await params.onSucceeded?.(row);
  } catch (e) {
    params.setLoadError?.(e instanceof Error ? e.message : String(e));
  } finally {
    set(evaluationRunRunningAtom, (prev) => (prev?.factorId === params.factorId ? null : prev));
  }
});
