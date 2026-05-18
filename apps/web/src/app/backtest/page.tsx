'use client';

import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { BacktestDetailPanel } from './components/backtest-detail-panel';
import { BacktestStatusBadge } from './components/backtest-status-badge';
import { BacktestStrategyTitle } from './components/backtest-strategy-title';
import { backtestsListAtoms } from '@/models/backtest/list.atom';
import { selectBacktestFromListAtom, startCreateBacktestAtom } from '@/models/backtest/panel.atom';
import { backtestsCreateModeAtom, backtestsSelectedIdAtom } from '@/models/backtest/selection.atom';
import { useBacktestEvents } from '@/models/backtest/use-backtest-events';
import type { BacktestRunSummary } from '@/models/backtest/dto';
import { BACKTEST_STATUS_LABEL } from './constants';

function formatBacktestListSearchText(item: {
  strategyId: string;
  strategyName: string | null;
  dataSetName: string | null;
  status: BacktestRunSummary['status'];
  error: string | null;
}) {
  const status = BACKTEST_STATUS_LABEL[item.status] ?? item.status;
  return [item.strategyName, item.strategyId, item.dataSetName, status, item.error, '策略已删除']
    .filter(Boolean)
    .join(' ');
}

export default function BacktestPage() {
  const items = useAtomValue(backtestsListAtoms.valueAtom);
  const [selectedId, setSelectedId] = useAtom(backtestsSelectedIdAtom);
  const isCreateMode = useAtomValue(backtestsCreateModeAtom);
  const selectBacktest = useSetAtom(selectBacktestFromListAtom);
  const startCreate = useSetAtom(startCreateBacktestAtom);
  const refreshList = useSetAtom(backtestsListAtoms.refreshAtom);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useBacktestEvents(refreshList);

  useLayoutEffect(() => {
    if (!items?.length || isCreateMode) return;
    if (selectedId == null || !items.some((x) => x.id === selectedId)) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId, isCreateMode, setSelectedId]);

  const onSelectBacktest = useCallback(
    (item: { id: string }) => {
      selectBacktest(item.id);
    },
    [selectBacktest],
  );

  const listSelectedId = isCreateMode ? null : selectedId;

  const backtestSearchListEmpty = resolveAsyncListEmptyState({
    loading: items == null,
    itemCount: items?.length ?? 0,
    emptyTitle: '暂无回测记录',
    emptyDescription: '使用「发起回测」提交任务后，记录将显示在此处。',
    filterEmptyDescription: '没有符合当前搜索条件的回测记录。',
  });

  return (
    <Page size="full" gap="sm" contentScroll="none" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isCreateMode} innerWidthClassName="w-[320px]">
        <SearchList
          className="h-full min-h-0"
          items={
            items?.map((r) => ({
              id: r.id,
              strategyId: r.strategy_id,
              strategyName: r.strategy_name,
              dataSetName: r.data_set_name,
              status: r.status,
              error: r.error,
              category: BACKTEST_STATUS_LABEL[r.status] ?? r.status,
            })) ?? null
          }
          getGroupKey={(item) => item.category ?? '其他'}
          renderTitle={(item) => (
            <BacktestStrategyTitle strategyId={item.strategyId} strategyName={item.strategyName} />
          )}
          renderDescription={(item) => (
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate">{item.dataSetName || '未命名数据集'}</span>
              <BacktestStatusBadge status={item.status} />
              {item.error ? <span className="truncate text-destructive">{item.error}</span> : null}
            </span>
          )}
          getSearchText={formatBacktestListSearchText}
          title="回测记录"
          searchPlaceholder="搜索回测"
          selectedId={listSelectedId}
          renderItem={(p) => <SearchListItem {...p} onItemSelected={onSelectBacktest} />}
          actions={[
            {
              label: '发起回测',
              icon: Plus,
              variant: 'default',
              size: 'icon',
              onClick: () => startCreate(),
            },
          ]}
        >
          <SearchListEmpty {...backtestSearchListEmpty} />
        </SearchList>
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BacktestDetailPanel />
      </div>
    </Page>
  );
}
