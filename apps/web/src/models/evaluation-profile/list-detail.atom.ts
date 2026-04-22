import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import type { EvaluationProfilePublic } from './dto';

const evaluationProfilesListRevisionAtom = atom(0);

const evaluationProfilesListAtom = atom(async (get) => {
  get(evaluationProfilesListRevisionAtom);
  try {
    const items = await listEvaluationProfiles();
    return { items, error: null as string | null };
  } catch (e) {
    return {
      items: [] as EvaluationProfilePublic[],
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

export const evaluationProfilesListItemsAtom = atom(async (get) => (await get(evaluationProfilesListAtom)).items);
export const evaluationProfilesListErrorAtom = atom(async (get) => (await get(evaluationProfilesListAtom)).error);

export const refreshEvaluationProfilesListAtom = atom(null, async (_get, set) => {
  set(evaluationProfilesListRevisionAtom, (n) => n + 1);
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
