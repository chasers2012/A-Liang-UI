import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { deleteStrategy, getStrategy, listStrategies } from '@/api/strategies';
import { listNodes } from '@/api/nodes';
import type { StrategyListPublic, StrategyPublic } from './dto';
import { NodeSummaryPublic } from '../nodes/dto';

export type StrategiesListState = {
  items: StrategyListPublic[] | null;
  error: string | null;
};

const strategiesListRevisionAtom = atom(0);

export const strategiesListAtom = atom(async (get) => {
  get(strategiesListRevisionAtom);
  try {
    const items = await listStrategies();
    return { items, error: null as string | null };
  } catch (e) {
    return {
      items: null as StrategyListPublic[] | null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

export const refreshStrategiesListAtom = atom(null, async (_get, set) => {
  set(strategiesListRevisionAtom, (n) => n + 1);
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
