'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAtomValue, useSetAtom } from 'jotai';

import {
  backtestDetailAtomFamily,
  deleteBacktestAtomFamily,
  loadBacktestDetailAtomFamily,
} from '@/models/backtest/list-detail.atom';
import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { EchartsOptionChart } from '@/components/echarts/echarts-option-chart';

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function asEquitySeries(equity_curve: Array<Record<string, unknown>>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const row of equity_curve) {
    const tRaw = row['date'] ?? row['index'] ?? row['datetime'] ?? row['timestamp'] ?? row['t'];
    const vRaw = row['value'] ?? row['equity'] ?? row['v'];
    const t = typeof tRaw === 'string' ? Date.parse(tRaw) : Number(tRaw);
    const v = Number(vRaw);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    out.push([t, v]);
  }
  return out;
}

function fmtValue(v: unknown): string {
  if (v == null) return '-';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function asStatsEntries(stats: unknown): Array<{ key: string; value: unknown }> {
  if (!stats) return [];
  if (Array.isArray(stats)) {
    const out: Array<{ key: string; value: unknown }> = [];
    for (const row of stats) {
      if (!isRecord(row)) continue;
      const keyRaw = row['index'] ?? row['metric'] ?? row['name'] ?? row['key'];
      const valRaw = row['value'];
      if (keyRaw == null) continue;
      out.push({ key: String(keyRaw), value: valRaw });
    }
    return out;
  }
  if (isRecord(stats)) {
    return Object.entries(stats).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function asTradeRows(trades: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(trades)) return [];
  return trades.filter((x): x is Record<string, unknown> => isRecord(x));
}

function BacktestRunDetailContent({
  invalidRunId,
  run,
  error,
  deleting,
  onDelete,
}: {
  invalidRunId: boolean;
  run: { id: string; status: string; strategy_id?: string | null; error?: string | null; results: unknown } | null;
  error: string | null;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const payload = isRecord(run?.results) ? run.results : null;
  const equitySeries = useMemo(
    () => asEquitySeries((payload?.equity_curve as Array<Record<string, unknown>> | undefined) ?? []),
    [payload],
  );
  const statsEntries = useMemo(() => asStatsEntries(payload?.stats), [payload]);
  const tradeRows = useMemo(() => asTradeRows((payload?.trades as unknown[] | undefined) ?? []), [payload]);
  const tradeColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const row of tradeRows) {
      for (const k of Object.keys(row)) cols.add(k);
    }
    return Array.from(cols);
  }, [tradeRows]);
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      xAxis: { type: equitySeries.length > 0 ? 'time' : 'category' },
      yAxis: { type: 'value', scale: true },
      series: [
        {
          name: 'Equity',
          type: 'line',
          showSymbol: false,
          data: equitySeries,
        },
      ],
    }),
    [equitySeries],
  );

  if (invalidRunId) {
    return (
      <Page title="回测详情">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>无效回测 ID</AlertDescription>
        </Alert>
      </Page>
    );
  }

  if (!run && !error) {
    return (
      <Page title="回测详情">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (error || !run) {
    return (
      <Page title="回测详情">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error ?? '未知错误'}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title={`回测 ${run.id}`}
      description={`状态：${run.status}`}
      action={
        <div className="flex items-center gap-2">
          {run.strategy_id ? (
            <Link
              href={`/strategies/${encodeURIComponent(run.strategy_id)}`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              查看策略
            </Link>
          ) : (
            <Button type="button" variant="outline" disabled>
              查看策略
            </Button>
          )}
          <Button type="button" variant="destructive" onClick={() => void onDelete()} disabled={deleting}>
            删除记录
          </Button>
        </div>
      }
    >
      {run.error ? (
        <Alert variant="destructive">
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription>{run.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>收益曲线</CardTitle>
        </CardHeader>
        <CardContent>
          <EchartsOptionChart option={option} className="h-[360px] min-h-[360px]" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>统计</CardTitle>
        </CardHeader>
        <CardContent>
          {statsEntries.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {statsEntries.map((item) => (
                <div key={item.key} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{item.key}</div>
                  <div className="mt-1 text-sm font-medium">{fmtValue(item.value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无统计数据</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交易记录</CardTitle>
        </CardHeader>
        <CardContent>
          {tradeRows.length && tradeColumns.length ? (
            <Table compact>
              <TableHeader>
                <TableRow>
                  {tradeColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradeRows.map((row, idx) => (
                  <TableRow key={String(row['id'] ?? row['Trade Id'] ?? idx)}>
                    {tradeColumns.map((col) => (
                      <TableCell key={`${idx}-${col}`} className="font-mono">
                        {fmtValue(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">暂无交易记录</p>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default function BacktestRunDetailPage() {
  const params = useParams<{ run_id?: string | string[] }>();
  const rawRunId = params?.run_id;
  const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;
  const router = useRouter();
  const invalidRunId = !runId || runId === 'undefined';

  const [deleting, setDeleting] = useState(false);
  const stateKey = runId ?? '';
  const { run, error } = useAtomValue(backtestDetailAtomFamily(stateKey));
  const load = useSetAtom(loadBacktestDetailAtomFamily(stateKey));
  const doDelete = useSetAtom(deleteBacktestAtomFamily(stateKey));

  useEffect(() => {
    if (invalidRunId) return;
    void load();
  }, [invalidRunId, load]);

  const onDelete = async () => {
    if (invalidRunId) return;
    setDeleting(true);
    try {
      await doDelete();
      router.push('/backtest');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BacktestRunDetailContent
      invalidRunId={invalidRunId}
      run={run}
      error={error}
      deleting={deleting}
      onDelete={onDelete}
    />
  );
}
