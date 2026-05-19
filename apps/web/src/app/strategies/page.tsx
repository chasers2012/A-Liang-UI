'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { toWorkflowNodeTypes } from '@/components/workflow-graph';
import { useHydrated } from '@/lib/use-hydrated';
import {
  refreshStrategyNodeTypesAtom,
  strategiesListAtoms,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import {
  cancelStrategyEditorAtom,
  enterStrategyEditorAtom,
  selectStrategyFromListAtom,
  startCreateStrategyAtom,
  strategiesListRefreshOnMountEffectAtom,
  strategiesPanelIsEditingAtom,
  strategiesPanelSelectedIdAtom,
} from '@/models/strategy/panel.atom';

import { StrategyDetailPanel } from './ui/strategy-detail-panel';

function StrategiesPageContent() {
  useAtom(strategiesListRefreshOnMountEffectAtom);

  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlInitDone = useRef(false);

  const items = useAtomValue(strategiesListAtoms.valueAtom);
  const listLoading = useAtomValue(strategiesListAtoms.loadingAtom);
  const error = useAtomValue(strategiesListAtoms.errorAtom);
  const refreshList = useSetAtom(strategiesListAtoms.refreshAtom);
  const refreshNodeTypes = useSetAtom(refreshStrategyNodeTypesAtom);
  const { items: nodeCatalog, error: nodeCatalogError } = useAtomValue(strategyNodeTypesAtom);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(nodeCatalog ?? []), [nodeCatalog]);

  const selectedId = useAtomValue(strategiesPanelSelectedIdAtom);
  const isEditing = useAtomValue(strategiesPanelIsEditingAtom);
  const setPanelSelectedId = useSetAtom(strategiesPanelSelectedIdAtom);
  const selectItem = useSetAtom(selectStrategyFromListAtom);
  const startCreate = useSetAtom(startCreateStrategyAtom);
  const enterEditor = useSetAtom(enterStrategyEditorAtom);
  const cancelStrategyEdit = useSetAtom(cancelStrategyEditorAtom);

  useNavigationEditGuard(strategiesPanelIsEditingAtom, {
    onAbandon: () => cancelStrategyEdit(),
  });

  const listSelectedId = isEditing && selectedId == null ? null : selectedId;

  /** 先于子组件：解析 URL（new / strategyId / edit），再默认选中列表首项。 */
  useLayoutEffect(() => {
    if (urlInitDone.current) return;
    urlInitDone.current = true;

    const strategyId = searchParams.get('strategyId');
    const wantNew = searchParams.get('new') === '1';
    const wantEdit = searchParams.get('edit') === '1';

    if (wantNew) {
      void startCreate();
      router.replace('/strategies', { scroll: false });
      return;
    }

    if (strategyId) {
      void selectItem(strategyId);
      if (wantEdit) void enterEditor();
      router.replace(`/strategies?strategyId=${encodeURIComponent(strategyId)}`, { scroll: false });
    }
  }, [searchParams, router, startCreate, selectItem, enterEditor]);

  useLayoutEffect(() => {
    if (!items?.length || isEditing) return;
    if (selectedId == null || !items.some((x) => x.id === selectedId)) {
      setPanelSelectedId(items[0].id);
    }
  }, [items, selectedId, isEditing, setPanelSelectedId]);

  useEffect(() => {
    void refreshList();
    void refreshNodeTypes();
  }, [refreshList, refreshNodeTypes]);

  useEffect(() => {
    if (isEditing && selectedId == null) {
      router.replace('/strategies', { scroll: false });
      return;
    }
    if (selectedId) {
      const next = `/strategies?strategyId=${encodeURIComponent(selectedId)}`;
      if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== next) {
        router.replace(next, { scroll: false });
      }
    }
  }, [selectedId, isEditing, router]);

  const strategiesSearchListPending = !hydrated || (listLoading && !error);
  const strategiesSearchListEmpty = resolveAsyncListEmptyState({
    loading: strategiesSearchListPending,
    error: error ? '策略列表加载失败。' : null,
    itemCount: items?.length ?? 0,
    emptyTitle: '暂无策略',
    emptyDescription: '请使用上方「新增策略」创建。',
    filterEmptyDescription: '没有符合当前筛选条件的策略。',
  });
  const strategiesSearchListItems = strategiesSearchListPending
    ? null
    : (items?.map((s) => ({ ...s, category: '策略' })) ?? null);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isEditing} innerWidthClassName="w-[320px]">
        <SearchList
          className="h-full min-h-0"
          items={strategiesSearchListItems}
          getGroupKey={(item) => item.category}
          searchKeys={['name', 'description', 'id']}
          title="策略列表"
          searchPlaceholder="搜索策略"
          selectedId={listSelectedId}
          renderItem={({ item, selectedId }) => (
            <SearchListItem
              item={item}
              selectedId={selectedId}
              title={item.name}
              description={item.description ?? ''}
              onClick={() => void selectItem(item.id)}
            />
          )}
          actions={[
            {
              label: '新增策略',
              icon: Plus,
              variant: 'default',
              size: 'icon',
              onClick: () => void startCreate(),
            },
          ]}
        >
          <SearchListEmpty {...strategiesSearchListEmpty} />
        </SearchList>
      </CollapsibleSearchListSidebar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StrategyDetailPanel nodeTypes={nodeTypes} nodeCatalogError={nodeCatalogError} />
      </div>
    </Page>
  );
}

export default function StrategiesPage() {
  return (
    <Suspense
      fallback={
        <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
          <PanelDetailCard title={null}>
            <SearchListEmpty variant="loading" title="加载中" />
          </PanelDetailCard>
        </Page>
      }
    >
      <StrategiesPageContent />
    </Suspense>
  );
}
