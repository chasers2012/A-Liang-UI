import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { EvaluationProfilePublic } from './dto';

export const evaluationProfilesListAtoms = createRefreshableAsyncAtoms<EvaluationProfilePublic[] | null>({
  initialValue: null,
  fetcher: listEvaluationProfiles,
});

export type EvaluationProfileDetailState = {
  row: EvaluationProfilePublic | null;
  error: string | null;
};

export const evaluationProfileDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<EvaluationProfileDetailState>({ row: null, error: null });
});

export const loadEvaluationProfileDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(evaluationProfileDetailAtomFamily(id), { row: null, error: null });
    try {
      const row = await getEvaluationProfile(id);
      set(evaluationProfileDetailAtomFamily(id), { row, error: null });
    } catch (e) {
      set(evaluationProfileDetailAtomFamily(id), {
        row: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);
