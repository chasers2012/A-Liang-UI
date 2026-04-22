import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import type { EvaluationProfilePublic } from './dto';

export const evaluationProfilesListItemsAtom = atom<EvaluationProfilePublic[]>([]);
export const evaluationProfilesListErrorAtom = atom<string | null>(null);

export const refreshEvaluationProfilesListAtom = atom(null, async (_get, set) => {
  set(evaluationProfilesListErrorAtom, null);
  try {
    const items = await listEvaluationProfiles();
    set(evaluationProfilesListItemsAtom, items);
    set(evaluationProfilesListErrorAtom, null);
  } catch (e) {
    set(evaluationProfilesListItemsAtom, []);
    set(evaluationProfilesListErrorAtom, e instanceof Error ? e.message : String(e));
  }
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
