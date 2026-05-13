'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { Button } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { toWorkflowNodeTypes } from '@/components/workflow-graph';
import {
  refreshStrategyNodeTypesAtom,
  strategiesListAtoms,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';
import {
  enterStrategyEditorAtom,
  selectStrategyFromListAtom,
  startCreateStrategyAtom,
  strategiesListRefreshOnMountEffectAtom,
  strategiesPanelIsEditingAtom,
  strategiesPanelSelectedIdAtom,
} from '@/models/strategy/panel.atom';

import { StrategyDetailPanel } from './ui/strategy-detail-panel';

function getEmptyText(error: string | null, itemCount: number): string {
  if (error) return '策略列表加载失败。';
  if (itemCount === 0) return '暂无策略。请使用上方「新增策略」创建。';
  return '没有符合当前筛选条件的策略。';
}

function StrategiesPageContent() {
  useAtom(strategiesListRefreshOnMountEffectAtom);

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlInitDone = useRef(false);

  const items = useAtomValue(strategiesListAtoms.valueAtom);
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

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isEditing} innerWidthClassName="w-[320px]">
        <SearchList
          className="h-full min-h-0"
          items={items?.map((s) => ({ ...s, category: '策略' })) ?? null}
          getGroupKey={(item) => item.category}
          renderTitle={(item) => item.name}
          renderDescription={(item) => item.description ?? ''}
          getSearchText={(item) => [item.name, item.description ?? '', item.id].join(' ')}
          title="策略列表"
          searchPlaceholder="搜索策略"
          selectedId={listSelectedId}
          emptyText={getEmptyText(error, items?.length ?? 0)}
          onItemSelected={(item) => void selectItem(item.id)}
          toolbarRight={
            <Button type="button" aria-label="新增策略" size="icon" onClick={() => void startCreate()}>
              <Plus className="size-4" />
            </Button>
          }
        />
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
            <div className="p-6 text-sm text-muted-foreground">加载中…</div>
          </PanelDetailCard>
        </Page>
      }
    >
      <StrategiesPageContent />
    </Suspense>
  );
}
