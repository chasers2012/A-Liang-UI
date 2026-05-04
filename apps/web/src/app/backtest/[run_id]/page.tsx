'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { EchartsOptionChart } from '@/components/echarts/echarts-option-chart';
import { BacktestWorkflowPanel } from './components/backtest-workflow-panel';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { resolveBacktestStateView } from './components/backtest-state-view';
import {
  backtestDetailAtomFamily,
  deleteBacktestAtomFamily,
  loadBacktestDetailAtomFamily,
} from '@/models/backtest/detail.atom';
import {
  loadStrategyDetailAtomFamily,
  refreshStrategyNodeTypesAtom,
  strategyDetailAtomFamily,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';
import { toWorkflowNodeTypes } from '@/components/workflow-graph';
import { asEquitySeries, asStatsEntries, asTradeRows, fmtValue, isRecord } from './utils';
import type { BacktestRunDetailViewData } from './types';

function BacktestTabCard({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <TabsContent value={value} className="mt-0 data-hidden:hidden">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </TabsContent>
  );
}

/* eslint-disable complexity */
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
  const runData = (run as BacktestRunDetailViewData | null) ?? null;
  const runResults = runData?.results;
  const payload = isRecord(runResults) ? runResults : null;
  const strategyId = runData?.strategy_id ?? '';
  const { row: strategyDetail, error: strategyError } = useAtomValue(strategyDetailAtomFamily(strategyId));
  const loadStrategyDetail = useSetAtom(loadStrategyDetailAtomFamily(strategyId));
  const { items: strategyNodeCatalog, error: strategyNodeCatalogError } = useAtomValue(strategyNodeTypesAtom);
  const refreshStrategyNodeTypes = useSetAtom(refreshStrategyNodeTypesAtom);

  const equitySeries = useMemo(
    () => asEquitySeries((payload?.equity_curve as Array<Record<string, unknown>> | undefined) ?? []),
    [payload],
  );
  const strategyNodeTypes = useMemo(() => toWorkflowNodeTypes(strategyNodeCatalog ?? []), [strategyNodeCatalog]);
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

  useEffect(() => {
    if (invalidRunId) return;
    void load();
  }, [invalidRunId, load]);

  useEffect(() => {
    if (!strategyId) return;
    void loadStrategyDetail();
  }, [loadStrategyDetail, strategyId]);

  useEffect(() => {
    if (!strategyId) return;
    void refreshStrategyNodeTypes();
  }, [refreshStrategyNodeTypes, strategyId]);

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

  const stateView = resolveBacktestStateView({ invalidRunId, run: runData, error });
  if (stateView) return stateView;
  const safeRun = runData as NonNullable<typeof runData>;

  return (
    <Page
      title={`回测 ${safeRun.id}`}
      description={`状态：${safeRun.status}`}
      action={
        <div className="flex items-center gap-2">
          {safeRun.strategy_id ? (
            <Link
              href={`/strategies?strategyId=${encodeURIComponent(safeRun.strategy_id)}`}
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
      {safeRun.error ? (
        <Alert variant="destructive">
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription>{safeRun.error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="strategy">
        <TabsList>
          <TabsTrigger value="strategy">策略</TabsTrigger>
          <TabsTrigger value="equity">收益曲线</TabsTrigger>
          <TabsTrigger value="stats">统计</TabsTrigger>
          <TabsTrigger value="trades">交易记录</TabsTrigger>
        </TabsList>
        <BacktestTabCard value="strategy" title="策略">
          <BacktestWorkflowPanel
            key={safeRun.id}
            runId={safeRun.id}
            strategyId={strategyId}
            strategyDetail={strategyDetail}
            strategyError={strategyError}
            strategyNodeCatalog={strategyNodeCatalog}
            strategyNodeCatalogError={strategyNodeCatalogError}
            strategyNodeTypes={strategyNodeTypes}
          />
        </BacktestTabCard>

        <BacktestTabCard value="equity" title="收益曲线">
          <EchartsOptionChart option={option} className="h-[360px] min-h-[360px]" />
        </BacktestTabCard>

        <BacktestTabCard value="stats" title="统计">
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
        </BacktestTabCard>

        <BacktestTabCard value="trades" title="交易记录">
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
        </BacktestTabCard>
      </Tabs>
    </Page>
  );
}
