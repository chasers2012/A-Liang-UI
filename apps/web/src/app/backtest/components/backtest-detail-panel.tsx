'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState } from '@/components/empty-state';
import { EchartsOptionChart } from '@/components/echarts/echarts-option-chart';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { BacktestWorkflowPanel } from './backtest-workflow-panel';
import { resolveBacktestDetailStatusContent } from './backtest-state-view';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  backtestDetailAtomFamily,
  deleteBacktestAtomFamily,
  loadBacktestDetailAtomFamily,
} from '@/models/backtest/detail.atom';
import { backtestsListAtoms } from '@/models/backtest/list.atom';
import { backtestsCreateModeAtom, backtestsSelectedIdAtom } from '@/models/backtest/selection.atom';
import { useBacktestEvents } from '@/models/backtest/use-backtest-events';
import {
  loadStrategyDetailAtomFamily,
  refreshStrategyNodeTypesAtom,
  strategyDetailAtomFamily,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';
import { toWorkflowNodeTypes } from '@/components/workflow-graph';
import { BacktestRecordTitle } from './backtest-record-title';
import { isBacktestStrategyDeleted } from '../constants';
import type { BacktestRunStatus } from '@/models/backtest/dto';
import { asEquitySeries, asStatsEntries, asTradeRows, fmtValue, isRecord } from '../utils';
import type { BacktestRunDetailViewData } from '../types';
import { BacktestCreateActions } from '../ui/backtest-create-actions';
import { BacktestRunForm } from '../ui/backtest-run-form';

type BacktestDetailTab = 'strategy' | 'performance' | 'trades' | 'run-error';

function BacktestRunErrorPanel({ error }: { error: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>运行失败</AlertTitle>
      <AlertDescription className="break-words whitespace-pre-wrap">{error}</AlertDescription>
    </Alert>
  );
}

function BacktestRunDetailContent({ runId }: { runId: string }) {
  const [deleting, setDeleting] = useState(false);
  const [detailTab, setDetailTab] = useState<BacktestDetailTab>('strategy');
  const setSelectedId = useSetAtom(backtestsSelectedIdAtom);
  const refreshList = useSetAtom(backtestsListAtoms.refreshAtom);
  const stateKey = runId;
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

  const refreshDetail = useCallback(() => {
    void load();
  }, [load]);

  const refreshAll = useCallback(
    (opts?: { silent?: boolean }) => {
      void refreshList(opts);
      refreshDetail();
    },
    [refreshDetail, refreshList],
  );

  useBacktestEvents(refreshAll);

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
    setDetailTab('strategy');
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!strategyId) return;
    void loadStrategyDetail();
  }, [loadStrategyDetail, strategyId]);

  useEffect(() => {
    if (!strategyId) return;
    void refreshStrategyNodeTypes();
  }, [refreshStrategyNodeTypes, strategyId]);

  const runError = runData?.error?.trim() ? runData.error : null;

  useEffect(() => {
    if (runError) setDetailTab('run-error');
  }, [runId, runError]);

  useEffect(() => {
    if (!runError && detailTab === 'run-error') setDetailTab('strategy');
  }, [runError, detailTab]);

  const detailPanels = useMemo(() => {
    if (!runData) return [];

    const panels: {
      value: BacktestDetailTab;
      label: string;
      content: ReactNode;
      fillHeight?: boolean;
    }[] = [];

    if (runError) {
      panels.push({
        value: 'run-error',
        label: '运行失败',
        content: <BacktestRunErrorPanel error={runError} />,
      });
    }

    panels.push(
      {
        value: 'strategy',
        label: '策略',
        fillHeight: true,
        content: (
          <BacktestWorkflowPanel
            key={runData.id}
            runId={runData.id}
            strategyId={strategyId}
            strategyDetail={strategyDetail}
            strategyError={strategyError}
            strategyNodeCatalog={strategyNodeCatalog}
            strategyNodeCatalogError={strategyNodeCatalogError}
            strategyNodeTypes={strategyNodeTypes}
          />
        ),
      },
      {
        value: 'performance',
        label: '收益统计',
        content: (
          <div className="flex flex-col gap-6">
            <EchartsOptionChart option={option} className="h-[360px] min-h-[360px] w-full shrink-0" />
            {statsEntries.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {statsEntries.map((item) => (
                  <div key={item.key} className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">{item.key}</div>
                    <div className="mt-1 text-sm font-medium">{fmtValue(item.value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无统计数据" compact />
            )}
          </div>
        ),
      },
      {
        value: 'trades',
        label: '交易记录',
        content:
          tradeRows.length > 0 && tradeColumns.length > 0 ? (
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
            <EmptyState title="暂无交易记录" compact />
          ),
      },
    );

    return panels;
  }, [
    runData,
    runError,
    strategyId,
    strategyDetail,
    strategyError,
    strategyNodeCatalog,
    strategyNodeCatalogError,
    strategyNodeTypes,
    option,
    statsEntries,
    tradeRows,
    tradeColumns,
  ]);

  const onDelete = async () => {
    setDeleting(true);
    try {
      await doDelete();
      setSelectedId(null);
    } finally {
      setDeleting(false);
    }
  };

  const statusContent = resolveBacktestDetailStatusContent({ run: runData, error });
  if (statusContent) {
    return (
      <PanelDetailCard title="回测详情" className="flex min-h-0 flex-1 flex-col">
        {statusContent}
      </PanelDetailCard>
    );
  }

  const safeRun = runData as NonNullable<typeof runData>;
  const isStrategyDeleted = isBacktestStrategyDeleted(safeRun.strategy_id, safeRun.strategy_name);

  const detailActions = (
    <div className="flex items-center gap-2">
      {safeRun.strategy_id && !isStrategyDeleted ? (
        <Link
          href={`/strategies?strategyId=${encodeURIComponent(safeRun.strategy_id)}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          查看策略
        </Link>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          查看策略
        </Button>
      )}
      <Button type="button" variant="destructive" size="sm" onClick={() => void onDelete()} disabled={deleting}>
        删除记录
      </Button>
    </div>
  );

  return (
    <PanelDetailCard
      title={
        <BacktestRecordTitle
          strategyId={safeRun.strategy_id}
          strategyName={safeRun.strategy_name}
          dataSetName={safeRun.data_set_name}
          status={safeRun.status as BacktestRunStatus}
          className="text-base"
        />
      }
      className="flex min-h-0 flex-1 flex-col"
      actions={detailActions}
      panelActiveTab={detailTab}
      onPanelActiveTabChange={(v) => {
        if (v === 'strategy' || v === 'performance' || v === 'trades' || (v === 'run-error' && runError)) {
          setDetailTab(v);
        }
      }}
      panels={detailPanels}
    />
  );
}

export function BacktestDetailPanel() {
  const selectedId = useAtomValue(backtestsSelectedIdAtom);
  const isCreateMode = useAtomValue(backtestsCreateModeAtom);

  if (isCreateMode) {
    return (
      <PanelDetailCard title="发起回测" className="flex min-h-0 flex-1 flex-col" actions={<BacktestCreateActions />}>
        <BacktestRunForm />
      </PanelDetailCard>
    );
  }

  if (!selectedId) {
    return (
      <PanelDetailCard title="回测详情" className="flex min-h-0 flex-1 flex-col">
        <EmptyState
          title="选择回测记录"
          description="在左侧列表中选择一条记录，或使用「发起回测」创建新任务。"
          className="flex min-h-0 flex-1"
        />
      </PanelDetailCard>
    );
  }

  return <BacktestRunDetailContent key={selectedId} runId={selectedId} />;
}
