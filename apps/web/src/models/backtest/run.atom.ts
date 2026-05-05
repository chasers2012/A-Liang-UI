import { atom } from 'jotai';

import type { BacktestRunFormSpec } from '@/api/backtests';
import { getBacktestRunSpec, runBacktest } from '@/api/backtests';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { strategiesListAtoms } from '@/models/strategy/list-detail.atom';

import { backtestsListAtoms } from './list.atom';

export type BacktestRunFormState = {
  strategyId: string;
  dataSetId: string;
  spec: BacktestRunFormSpec | null;
  formData: Record<string, unknown>;
  submitting: boolean;
  catalogLoading: boolean;
  specLoading: boolean;
  error: string | null;
};

export const backtestRunFormAtom = atom<BacktestRunFormState>({
  strategyId: '',
  dataSetId: '',
  spec: null,
  formData: {},
  submitting: false,
  catalogLoading: true,
  specLoading: true,
  error: null,
});

export const loadBacktestRunCatalogAtom = atom(null, async (get, set) => {
  set(backtestRunFormAtom, (s) => ({ ...s, catalogLoading: true, error: null }));
  try {
    // Read catalog atoms directly so initial load happens once per mount flow.
    // Avoid forcing refresh here; otherwise it can trigger repeated fetch loops.
    const [strategies, dataSets] = await Promise.all([
      get(strategiesListAtoms.valueAtom) ?? [],
      get(dataSetAtoms.valueAtom) ?? [],
    ]);
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

export const loadBacktestRunSpecAtom = atom(null, async (_get, set) => {
  set(backtestRunFormAtom, (s) => ({ ...s, specLoading: true, error: null }));
  try {
    const spec = await getBacktestRunSpec();
    set(backtestRunFormAtom, (s) => ({
      ...s,
      spec,
      formData: Object.keys(s.formData ?? {}).length ? s.formData : (spec.default_values ?? {}),
      specLoading: false,
    }));
  } catch (e) {
    set(backtestRunFormAtom, (s) => ({
      ...s,
      specLoading: false,
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

export const setBacktestRunFormDataAtom = atom(null, (_get, set, value: Record<string, unknown>) => {
  set(backtestRunFormAtom, (s) => ({ ...s, formData: value }));
});

export const submitBacktestRunAtom = atom(null, async (get, set) => {
  const { strategyId, dataSetId, formData } = get(backtestRunFormAtom);
  const sid = strategyId.trim();
  const did = dataSetId.trim();
  if (!sid || !did) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: '请选择策略与数据集' }));
    return;
  }

  set(backtestRunFormAtom, (s) => ({ ...s, submitting: true, error: null }));
  try {
    await runBacktest({
      strategy_id: sid,
      data_set_id: did,
      ...(formData ?? {}),
    });
    set(backtestRunFormAtom, (s) => ({ ...s, submitting: false }));
    await set(backtestsListAtoms.refreshAtom);
  } catch (e) {
    set(backtestRunFormAtom, (s) => ({
      ...s,
      submitting: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});
