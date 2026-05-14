import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import { listNodes } from '@/api/nodes';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { EvaluationProfilePublic } from './dto';
import type { NodeSummaryPublic } from '@/models/nodes/dto';
import {
  adjustEvaluationProfilesPanelLoadingDepthAtom,
  evaluationProfilesPanelErrorAtom,
  evaluationProfilesPanelIsEditingAtom,
} from '@/models/evaluation-profile/panel.atom';

export const evaluationProfilesListAtoms = createRefreshableAsyncAtoms<EvaluationProfilePublic[] | null>({
  initialValue: null,
  fetcher: listEvaluationProfiles,
});

export type EvaluationProfileDetailState = {
  row: EvaluationProfilePublic | null;
};

export const evaluationProfileDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<EvaluationProfileDetailState>({ row: null });
});

export const loadEvaluationProfileDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(adjustEvaluationProfilesPanelLoadingDepthAtom, 1);
    try {
      set(evaluationProfilesPanelErrorAtom, null);
      set(evaluationProfileDetailAtomFamily(id), { row: null });
      const row = await getEvaluationProfile(id);
      set(evaluationProfileDetailAtomFamily(id), { row });
      set(evaluationProfilesPanelErrorAtom, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(evaluationProfileDetailAtomFamily(id), { row: null });
      set(evaluationProfilesPanelErrorAtom, msg);
    } finally {
      set(adjustEvaluationProfilesPanelLoadingDepthAtom, -1);
    }
  }),
);

export type EvaluationProfileNodeTypesState = {
  items: NodeSummaryPublic[] | null;
};

export const evaluationProfileNodeTypesAtom = atom<EvaluationProfileNodeTypesState>({
  items: null,
});

export const refreshEvaluationProfileNodeTypesAtom = atom(null, async (get, set) => {
  try {
    const items = await listNodes('evaluation-profile');
    set(evaluationProfileNodeTypesAtom, { items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    set(evaluationProfileNodeTypesAtom, { items: null });
    if (!get(evaluationProfilesPanelIsEditingAtom)) {
      set(evaluationProfilesPanelErrorAtom, msg);
    }
  }
});
