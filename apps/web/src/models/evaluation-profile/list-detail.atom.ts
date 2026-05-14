import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import { listNodes } from '@/api/nodes';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { EvaluationProfilePublic } from './dto';
import type { NodeSummaryPublic } from '@/models/nodes/dto';
import { adjustLoadingDepthAtom, errorAtom, isEditingAtom } from '@/models/evaluation-profile/scope.atom';

export const listAtoms = createRefreshableAsyncAtoms<EvaluationProfilePublic[] | null>({
  initialValue: null,
  fetcher: listEvaluationProfiles,
});

export type DetailState = {
  row: EvaluationProfilePublic | null;
};

export const detailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<DetailState>({ row: null });
});

export const loadDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(adjustLoadingDepthAtom, 1);
    try {
      set(errorAtom, null);
      set(detailAtomFamily(id), { row: null });
      const row = await getEvaluationProfile(id);
      set(detailAtomFamily(id), { row });
      set(errorAtom, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(detailAtomFamily(id), { row: null });
      set(errorAtom, msg);
    } finally {
      set(adjustLoadingDepthAtom, -1);
    }
  }),
);

export type NodeTypesState = {
  items: NodeSummaryPublic[] | null;
};

export const nodeTypesAtom = atom<NodeTypesState>({
  items: null,
});

export const refreshNodeTypesAtom = atom(null, async (get, set) => {
  try {
    const items = await listNodes('evaluation-profile');
    set(nodeTypesAtom, { items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    set(nodeTypesAtom, { items: null });
    if (!get(isEditingAtom)) {
      set(errorAtom, msg);
    }
  }
});
