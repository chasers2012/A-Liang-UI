import { atom } from 'jotai';

import { listBacktests } from '@/api/backtests';

import type { BacktestRunSummary } from './dto';

export type BacktestsListState = {
  items: BacktestRunSummary[] | null;
  error: string | null;
};

export const backtestsListAtom = atom<BacktestsListState>({
  items: null,
  error: null,
});

export const refreshBacktestsListAtom = atom(null, async (_get, set) => {
  set(backtestsListAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listBacktests({ limit: 50 });
    set(backtestsListAtom, { items, error: null });
  } catch (e) {
    set(backtestsListAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
