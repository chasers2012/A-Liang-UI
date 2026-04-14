'use client';

import type { FormEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  backtestRunCatalogAtom,
  backtestRunFormAtom,
  loadBacktestRunCatalogAtom,
  setBacktestRunDataSetIdAtom,
  setBacktestRunStrategyIdAtom,
  submitBacktestRunAtom,
} from '@/models/backtest/list-detail.atom';
import { useEffect } from 'react';

export function BacktestRunForm() {
  const { strategyId, dataSetId, submitting, catalogLoading, error } = useAtomValue(backtestRunFormAtom);
  const { strategies, dataSets } = useAtomValue(backtestRunCatalogAtom);

  const loadCatalog = useSetAtom(loadBacktestRunCatalogAtom);
  const setStrategyId = useSetAtom(setBacktestRunStrategyIdAtom);
  const setDataSetId = useSetAtom(setBacktestRunDataSetIdAtom);
  const submit = useSetAtom(submitBacktestRunAtom);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const submitDisabled = submitting || catalogLoading || !strategyId.trim() || !dataSetId.trim() || !strategies.length || !dataSets.length;

  const onRun = async (e: FormEvent) => {
    e.preventDefault();
    await submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>发起回测</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => void onRun(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor="strategy_id">strategy_id</Label>
            <Select value={strategyId || undefined} onValueChange={(v) => v && setStrategyId(v)}>
              <SelectTrigger id="strategy_id" className="w-full">
                <SelectValue placeholder={catalogLoading ? '加载中…' : '选择策略'} />
              </SelectTrigger>
              <SelectContent>
                {strategies.length ? (
                  strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="truncate">{s.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{s.id}</span>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__empty_strategies__" disabled>
                    暂无策略
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="data_set_id">data_set_id</Label>
            <Select value={dataSetId || undefined} onValueChange={(v) => v && setDataSetId(v)}>
              <SelectTrigger id="data_set_id" className="w-full">
                <SelectValue placeholder={catalogLoading ? '加载中…' : '选择数据集'} />
              </SelectTrigger>
              <SelectContent>
                {dataSets.length ? (
                  dataSets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="truncate">{d.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{d.id}</span>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__empty_datasets__" disabled>
                    暂无数据集
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={submitDisabled}>
              {submitting ? '提交中…' : '提交'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
