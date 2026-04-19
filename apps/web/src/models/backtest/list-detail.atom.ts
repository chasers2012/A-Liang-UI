import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { deleteBacktest, getBacktest, listBacktests, runBacktest } from '@/api/backtests';
import { listDataSets } from '@/api/data-sets';
import { listStrategies } from '@/api/strategies';
import type { DataSetPublic } from '@/models/data-set/dto';
import type { StrategyListPublic } from '@/models/strategy/dto';

import type { BacktestRunDetail, BacktestRunSummary } from './dto';

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

export type BacktestRunFormState = {
  strategyId: string;
  dataSetId: string;
  initialCash: string;
  fees: string;
  slippage: string;
  submitting: boolean;
  catalogLoading: boolean;
  error: string | null;
};

export const backtestRunFormAtom = atom<BacktestRunFormState>({
  strategyId: '',
  dataSetId: '',
  initialCash: '1000000',
  fees: '0.0003',
  slippage: '0',
  submitting: false,
  catalogLoading: true,
  error: null,
});

export type BacktestRunCatalogState = {
  strategies: StrategyListPublic[];
  dataSets: DataSetPublic[];
};

export const backtestRunCatalogAtom = atom<BacktestRunCatalogState>({
  strategies: [],
  dataSets: [],
});

export const loadBacktestRunCatalogAtom = atom(null, async (_get, set) => {
  set(backtestRunFormAtom, (s) => ({ ...s, catalogLoading: true, error: null }));
  try {
    const [strategies, dataSets] = await Promise.all([listStrategies(), listDataSets()]);
    set(backtestRunCatalogAtom, { strategies, dataSets });
    set(backtestRunFormAtom, (s) => ({
      ...s,
      catalogLoading: false,
      strategyId: s.strategyId || strategies[0]?.id || '',
      dataSetId: s.dataSetId || dataSets[0]?.id || '',
    }));
  } catch (e) {
    set(backtestRunCatalogAtom, { strategies: [], dataSets: [] });
    set(backtestRunFormAtom, (s) => ({
      ...s,
      catalogLoading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});

export const setBacktestRunStrategyIdAtom = atom(null, (_get, set, id: string) => {
  set(backtestRunFormAtom, (s) => ({ ...s, strategyId: id }));
});

export const setBacktestRunDataSetIdAtom = atom(null, (_get, set, id: string) => {
  set(backtestRunFormAtom, (s) => ({ ...s, dataSetId: id }));
});

export const setBacktestRunInitialCashAtom = atom(null, (_get, set, value: string) => {
  set(backtestRunFormAtom, (s) => ({ ...s, initialCash: value }));
});

export const setBacktestRunFeesAtom = atom(null, (_get, set, value: string) => {
  set(backtestRunFormAtom, (s) => ({ ...s, fees: value }));
});

export const setBacktestRunSlippageAtom = atom(null, (_get, set, value: string) => {
  set(backtestRunFormAtom, (s) => ({ ...s, slippage: value }));
});

export const submitBacktestRunAtom = atom(null, async (get, set) => {
  const { strategyId, dataSetId, initialCash, fees, slippage } = get(backtestRunFormAtom);
  const sid = strategyId.trim();
  const did = dataSetId.trim();
  if (!sid || !did) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: '请选择策略与数据集' }));
    return;
  }
  const initialCashNum = Number(initialCash);
  const feesNum = Number(fees);
  const slippageNum = Number(slippage);
  if (!Number.isFinite(initialCashNum) || initialCashNum <= 0) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: 'initial_cash 必须大于 0' }));
    return;
  }
  if (!Number.isFinite(feesNum) || feesNum < 0) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: 'fees 不能小于 0' }));
    return;
  }
  if (!Number.isFinite(slippageNum) || slippageNum < 0) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: 'slippage 不能小于 0' }));
    return;
  }

  set(backtestRunFormAtom, (s) => ({ ...s, submitting: true, error: null }));
  try {
    await runBacktest({
      strategy_id: sid,
      data_set_id: did,
      initial_cash: initialCashNum,
      fees: feesNum,
      slippage: slippageNum,
    });
    set(backtestRunFormAtom, (s) => ({ ...s, submitting: false }));
    await set(refreshBacktestsListAtom);
  } catch (e) {
    set(backtestRunFormAtom, (s) => ({
      ...s,
      submitting: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});

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
    set(backtestDetailAtomFamily(runId), { run: null, equity: null, trades: null, error: null });
    await set(refreshBacktestsListAtom);
  }),
);
