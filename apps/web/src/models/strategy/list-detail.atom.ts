import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { deleteStrategy, getStrategy, listStrategies } from '@/api/strategies';
import { listNodes } from '@/api/nodes';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { StrategyListPublic, StrategyPublic } from './dto';
import { NodeSummaryPublic } from '../nodes/dto';

export const strategiesListAtoms = createRefreshableAsyncAtoms<StrategyListPublic[] | null>({
  initialValue: null,
  fetcher: listStrategies,
});

export type StrategyDetailState = {
  row: StrategyPublic | null;
  error: string | null;
};

export const strategyDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<StrategyDetailState>({ row: null, error: null });
});

export const loadStrategyDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(strategyDetailAtomFamily(id), { row: null, error: null });
    try {
      const row = await getStrategy(id);
      set(strategyDetailAtomFamily(id), { row, error: null });
    } catch (e) {
      set(strategyDetailAtomFamily(id), {
        row: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);

export const deleteStrategyAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    await deleteStrategy(id);
    // Best-effort refresh list + clear detail state.
    set(strategyDetailAtomFamily(id), { row: null, error: null });
    await set(strategiesListAtoms.refreshAtom);
  }),
);

export type StrategyNodeTypesState = {
  items: NodeSummaryPublic[] | null;
  error: string | null;
};

export const strategyNodeTypesAtom = atom<StrategyNodeTypesState>({
  items: null,
  error: null,
});

export const refreshStrategyNodeTypesAtom = atom(null, async (_get, set) => {
  set(strategyNodeTypesAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listNodes('strategy');
    set(strategyNodeTypesAtom, { items, error: null });
  } catch (e) {
    set(strategyNodeTypesAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
