import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { deleteStrategy, getStrategy, listStrategies } from '@/api';
import { listNodes } from '@/api/nodes';
import type { StrategyPublic } from './dto';
import { NodeSummaryPublic } from '../nodes/dto';

export type StrategiesListState = {
  items: StrategyPublic[] | null;
  error: string | null;
};

export const strategiesListAtom = atom<StrategiesListState>({
  items: null,
  error: null,
});

export const refreshStrategiesListAtom = atom(null, async (_get, set) => {
  set(strategiesListAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listStrategies();
    set(strategiesListAtom, { items, error: null });
  } catch (e) {
    set(strategiesListAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
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
    await set(refreshStrategiesListAtom);
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
    set(strategyNodeTypesAtom, { items: items as NodeSummaryPublic[], error: null });
  } catch (e) {
    set(strategyNodeTypesAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
