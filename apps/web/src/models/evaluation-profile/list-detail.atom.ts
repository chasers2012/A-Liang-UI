import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getEvaluationProfile, listEvaluationProfiles } from '@/api/evaluation-profiles';
import { listNodes } from '@/api/nodes';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { EvaluationProfilePublic } from './dto';
import type { NodeSummaryPublic } from '@/models/nodes/dto';
import { errorAtom, isEditingAtom, loadingAtom } from '@/models/evaluation-profile/scope.atom';

export const listAtoms = createRefreshableAsyncAtoms<EvaluationProfilePublic[] | null>({
  initialValue: null,
  fetcher: listEvaluationProfiles,
});

export const detailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<EvaluationProfilePublic | null>(null);
});

export const loadDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(loadingAtom, true);
    try {
      set(errorAtom, null);
      set(detailAtomFamily(id), null);
      const row = await getEvaluationProfile(id);
      set(detailAtomFamily(id), row);
      set(errorAtom, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(detailAtomFamily(id), null);
      set(errorAtom, msg);
    } finally {
      set(loadingAtom, false);
    }
  }),
);

export const nodeTypesAtom = atom<NodeSummaryPublic[] | null>(null);

export const refreshNodeTypesAtom = atom(null, async (get, set) => {
  try {
    const items = await listNodes('evaluation-profile');
    set(nodeTypesAtom, items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    set(nodeTypesAtom, null);
    if (!get(isEditingAtom)) {
      set(errorAtom, msg);
    }
  }
});
