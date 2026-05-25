'use client';

import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
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
import { BACKTEST_STATUS_LABEL } from './constants';

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
      <CollapsibleSidebar collapsed={isCreateMode} drawerTitle="回测">
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
          searchKeys={['strategyName', 'strategyId', 'dataSetName', 'status', 'error', 'category', 'id']}
          title="回测记录"
          searchPlaceholder="搜索回测"
          selectedId={listSelectedId}
          renderItem={({ item, selectedId }) => (
            <SearchListItem
              item={item}
              selectedId={selectedId}
              title={<BacktestStrategyTitle strategyId={item.strategyId} strategyName={item.strategyName} />}
              description={
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate">{item.dataSetName || '未命名数据集'}</span>
                  <BacktestStatusBadge status={item.status} />
                  {item.error ? <span className="truncate text-destructive">{item.error}</span> : null}
                </span>
              }
              onClick={() => onSelectBacktest(item)}
            />
          )}
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
      </CollapsibleSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BacktestDetailPanel />
      </div>
    </Page>
  );
}
