import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { deleteBacktest, getBacktest } from '@/api/backtests';

import type { BacktestRunDetail } from './dto';
import { backtestsListAtoms } from './list.atom';

export type BacktestDetailState = {
  run: BacktestRunDetail | null;
  error: string | null;
};

export const backtestDetailAtomFamily = atomFamily((runId: string) => {
  void runId;
  return atom<BacktestDetailState>({
    run: null,
    error: null,
  });
});

export const loadBacktestDetailAtomFamily = atomFamily((runId: string) =>
  atom(null, async (_get, set) => {
    if (!runId) return;
    set(backtestDetailAtomFamily(runId), { run: null, error: null });
    try {
      const run = await getBacktest(runId);
      set(backtestDetailAtomFamily(runId), { run, error: null });
    } catch (e) {
      set(backtestDetailAtomFamily(runId), {
        run: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);

export const deleteBacktestAtomFamily = atomFamily((runId: string) =>
  atom(null, async (_get, set) => {
    if (!runId) return;
    await deleteBacktest(runId);
    set(backtestDetailAtomFamily(runId), { run: null, error: null });
    await set(backtestsListAtoms.refreshAtom);
  }),
);
