import { atom } from 'jotai';

import { runBacktest } from '@/api/backtests';
import { dataSetsItemsAtom } from '@/models/data-set/panel-detail.atom';
import { strategiesListAtom } from '@/models/strategy/list-detail.atom';

import { refreshBacktestsListAtom } from './list.atom';

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

export const backtestRunStrategiesAtom = atom(async (get) => (await get(strategiesListAtom)).items ?? []);
export const backtestRunDataSetsAtom = atom(async (get) => (await get(dataSetsItemsAtom)) ?? []);

export const loadBacktestRunCatalogAtom = atom(null, async (get, set) => {
  set(backtestRunFormAtom, (s) => ({ ...s, catalogLoading: true, error: null }));
  try {
    // Read catalog atoms directly so initial load happens once per mount flow.
    // Avoid forcing refresh here; otherwise it can trigger repeated fetch loops.
    const [strategies, dataSets] = await Promise.all([get(backtestRunStrategiesAtom), get(backtestRunDataSetsAtom)]);
    set(backtestRunFormAtom, (s) => ({
      ...s,
      catalogLoading: false,
      strategyId: s.strategyId || strategies[0]?.id || '',
      dataSetId: s.dataSetId || dataSets[0]?.id || '',
    }));
  } catch (e) {
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
