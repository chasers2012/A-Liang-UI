import type { FactorEvaluationRowPublic } from '@/models/factor/dto';
import { apiFetchJson } from './client';

export function runFactorEvaluation(
  factorId: string,
  options: {
    dataSetId?: string | null;
    evaluationProfileId: string;
  },
): Promise<FactorEvaluationRowPublic> {
  const profileId = options.evaluationProfileId.trim();
  if (!profileId) {
    return Promise.reject(new Error('evaluationProfileId is required'));
  }
  const init: RequestInit = { method: 'POST' };
  const body: Record<string, string> = {
    profile_id: profileId,
    factor_id: factorId,
  };
  const ds = options.dataSetId?.trim();
  if (ds) {
    body.data_set_id = ds;
  }
  init.body = JSON.stringify(body);
  return apiFetchJson<FactorEvaluationRowPublic>('/evaluation/run', init);
}
