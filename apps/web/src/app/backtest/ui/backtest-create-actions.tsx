'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import { cancelCreateBacktestAtom } from '@/models/backtest/panel.atom';
import { backtestRunFormAtom, submitBacktestRunAtom } from '@/models/backtest/run.atom';

export function BacktestCreateActions() {
  const { formData, submitting, specLoading } = useAtomValue(backtestRunFormAtom);
  const submit = useSetAtom(submitBacktestRunAtom);
  const cancel = useSetAtom(cancelCreateBacktestAtom);

  const submitDisabled =
    submitting ||
    specLoading ||
    !String(formData?.strategy_id ?? '').trim() ||
    !String(formData?.data_set_id ?? '').trim();

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => cancel()}>
        取消
      </Button>
      <Button type="button" size="sm" disabled={submitDisabled} onClick={() => void submit()}>
        {submitting ? '提交中…' : '提交'}
      </Button>
    </>
  );
}
