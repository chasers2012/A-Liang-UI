import { atom } from 'jotai';

import type { BacktestRunFormSpec } from '@/api/backtests';
import { getBacktestRunSpec, runBacktest } from '@/api/backtests';

import { backtestsListAtoms } from './list.atom';
import { backtestsCreateModeAtom, backtestsSelectedIdAtom } from './selection.atom';

export type BacktestRunFormState = {
  spec: BacktestRunFormSpec | null;
  formData: Record<string, unknown>;
  submitting: boolean;
  specLoading: boolean;
  error: string | null;
};

export const backtestRunFormAtom = atom<BacktestRunFormState>({
  spec: null,
  formData: {},
  submitting: false,
  specLoading: true,
  error: null,
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

export const setBacktestRunFormDataAtom = atom(null, (_get, set, value: Record<string, unknown>) => {
  set(backtestRunFormAtom, (s) => ({ ...s, formData: value }));
});

export const submitBacktestRunAtom = atom(null, async (get, set) => {
  const { formData } = get(backtestRunFormAtom);
  const sid = String(formData?.strategy_id ?? '').trim();
  const did = String(formData?.data_set_id ?? '').trim();
  if (!sid || !did) {
    set(backtestRunFormAtom, (s) => ({ ...s, error: '请选择策略与数据集' }));
    return;
  }

  set(backtestRunFormAtom, (s) => ({ ...s, submitting: true, error: null }));
  try {
    const created = await runBacktest({
      strategy_id: sid,
      data_set_id: did,
      params: formData ?? {},
    });
    set(backtestRunFormAtom, (s) => ({ ...s, submitting: false }));
    set(backtestsCreateModeAtom, false);
    set(backtestsSelectedIdAtom, created.id);
    await set(backtestsListAtoms.refreshAtom);
  } catch (e) {
    set(backtestRunFormAtom, (s) => ({
      ...s,
      submitting: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});
