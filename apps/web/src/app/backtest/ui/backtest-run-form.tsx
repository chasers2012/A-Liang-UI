'use client';

import type { FormEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import {
  backtestRunFormAtom,
  loadBacktestRunCatalogAtom,
  setBacktestRunDataSetIdAtom,
  setBacktestRunFeesAtom,
  setBacktestRunInitialCashAtom,
  setBacktestRunSlippageAtom,
  setBacktestRunStrategyIdAtom,
  submitBacktestRunAtom,
} from '@/models/backtest/run.atom';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { strategiesListAtoms } from '@/models/strategy/list-detail.atom';

type NamedOption = { id: string; name: string };

function BacktestCatalogSelect(props: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  loading: boolean;
  placeholder: string;
  emptyText: string;
  options: NamedOption[];
}) {
  const { id, label, value, onValueChange, loading, placeholder, emptyText, options } = props;
  const selectedLabel = options.find((o) => o.id === value)?.name ?? '';

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select modal={false} value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? '加载中…' : placeholder}>{selectedLabel || undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.length ? (
            options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="truncate">{o.name}</span>
              </SelectItem>
            ))
          ) : (
            <SelectItem value={`__empty__${id}__`} disabled>
              {emptyText}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BacktestRunForm() {
  const { strategyId, dataSetId, initialCash, fees, slippage, submitting, catalogLoading, error } =
    useAtomValue(backtestRunFormAtom);
  const strategies = useAtomValue(strategiesListAtoms.valueAtom) ?? [];
  const dataSets = useAtomValue(dataSetAtoms.valueAtom) ?? [];

  const loadCatalog = useSetAtom(loadBacktestRunCatalogAtom);
  const setStrategyId = useSetAtom(setBacktestRunStrategyIdAtom);
  const setDataSetId = useSetAtom(setBacktestRunDataSetIdAtom);
  const setInitialCash = useSetAtom(setBacktestRunInitialCashAtom);
  const setFees = useSetAtom(setBacktestRunFeesAtom);
  const setSlippage = useSetAtom(setBacktestRunSlippageAtom);
  const submit = useSetAtom(submitBacktestRunAtom);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const submitDisabled =
    submitting || catalogLoading || !strategyId.trim() || !dataSetId.trim() || !strategies.length || !dataSets.length;

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
          <BacktestCatalogSelect
            id="strategy_id"
            label="strategy_id"
            value={strategyId}
            onValueChange={setStrategyId}
            loading={catalogLoading}
            placeholder="选择策略"
            emptyText="暂无策略"
            options={strategies}
          />

          <BacktestCatalogSelect
            id="data_set_id"
            label="data_set_id"
            value={dataSetId}
            onValueChange={setDataSetId}
            loading={catalogLoading}
            placeholder="选择数据集"
            emptyText="暂无数据集"
            options={dataSets}
          />

          <div className="flex items-end">
            <Button type="submit" disabled={submitDisabled}>
              {submitting ? '提交中…' : '提交'}
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="initial_cash">initial_cash</Label>
            <Input
              id="initial_cash"
              type="number"
              min={0.0000001}
              step="any"
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fees">fees</Label>
            <Input id="fees" type="number" min={0} step="any" value={fees} onChange={(e) => setFees(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="slippage">slippage</Label>
            <Input
              id="slippage"
              type="number"
              min={0}
              step="any"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
