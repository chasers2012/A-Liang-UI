'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAtomValue, useSetAtom } from 'jotai';

import { backtestDetailAtomFamily, deleteBacktestAtomFamily, loadBacktestDetailAtomFamily } from '@/models/backtest/list-detail.atom';
import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function BacktestRunDetailContent({
  invalidRunId,
  run,
  equity,
  trades,
  error,
  deleting,
  onDelete,
}: {
  invalidRunId: boolean;
  run: { id: string; status: string; strategy_id?: string | null; error?: string | null; results: unknown } | null;
  equity: { equity_curve?: Array<Record<string, unknown>> } | null;
  trades: { trades?: unknown[] } | null;
  error: string | null;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const equitySeries = useMemo(() => asEquitySeries(equity?.equity_curve ?? []), [equity]);
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
            <Link href={`/strategies/${encodeURIComponent(run.strategy_id)}`} className={cn(buttonVariants({ variant: 'outline' }))}>
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
          <pre className="max-h-[320px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(isRecord(run.results) && 'stats' in run.results ? (run.results as Record<string, unknown>)['stats'] : run.results, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交易摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[320px] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(trades?.trades ?? [], null, 2)}</pre>
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
  const { run, equity, trades, error } = useAtomValue(backtestDetailAtomFamily(stateKey));
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

  return <BacktestRunDetailContent invalidRunId={invalidRunId} run={run} equity={equity} trades={trades} error={error} deleting={deleting} onDelete={onDelete} />;
}
