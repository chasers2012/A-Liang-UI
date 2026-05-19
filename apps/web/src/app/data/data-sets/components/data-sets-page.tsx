'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { datasourcesListAtoms } from '@/models/datasource/panel.atom';
import { handleCancelDataSetEditAtom } from '@/models/data-set/edit.atom';
import {
  dataSetsEnterCreateAtom,
  dataSetsIsEditingAtom,
  dataSetsSelectAndDetailAtom,
} from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

import { DataSetDetailPanel } from './panel/data-set-detail-panel';

/** 与 `apps/web/src/app/nodes/page.tsx` 对齐：左列表 + 右卡片，状态全部走 jotai */
export function DataSetsPage() {
  const items = useAtomValue(dataSetAtoms.valueAtom);
  const selectedId = useAtomValue(dataSetsSelectedIdAtom);

  const selectDetail = useSetAtom(dataSetsSelectAndDetailAtom);
  const enterCreate = useSetAtom(dataSetsEnterCreateAtom);
  const refreshDataSets = useSetAtom(dataSetAtoms.refreshAtom);
  const refreshDatasources = useSetAtom(datasourcesListAtoms.refreshAtom);
  const listError = useAtomValue(dataSetAtoms.errorAtom);
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const cancelDataSetEdit = useSetAtom(handleCancelDataSetEditAtom);

  useNavigationEditGuard(dataSetsIsEditingAtom, {
    onAbandon: () => void cancelDataSetEdit(),
  });

  useEffect(() => {
    void refreshDataSets();
    void refreshDatasources();
  }, [refreshDataSets, refreshDatasources]);

  const onSelectItem = useCallback(
    (item: { id: string }) => {
      selectDetail(item.id);
    },
    [selectDetail],
  );

  const dataSetsSearchListEmpty = resolveAsyncListEmptyState({
    loading: items == null,
    error: listError ? '数据集列表加载失败。' : null,
    itemCount: items?.length ?? 0,
    emptyTitle: '暂无数据集',
    emptyDescription: '请使用上方「新增数据集」开始配置。',
    filterEmptyDescription: '没有符合搜索条件的数据集。',
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isEditing} innerWidthClassName="w-[320px]">
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          {listError ? (
            <Alert variant="destructive">
              <AlertTitle>无法加载列表</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
          <SearchList
            className="h-full min-h-0"
            items={
              items?.map((m) => ({
                id: m.id,
                label: m.name,
                description: m.description,
                datasourceType: m.datasource_bindings?.[0]?.datasource_type ?? '',
              })) ?? null
            }
            searchKeys={['label', 'description', 'datasourceType']}
            title="数据集列表"
            searchPlaceholder="搜索数据集"
            selectedId={selectedId}
            renderItem={({ item, selectedId }) => (
              <SearchListItem
                item={item}
                selectedId={selectedId}
                title={item.label}
                dense
                onClick={() => onSelectItem(item)}
              />
            )}
            actions={[
              {
                label: '新增数据集',
                icon: Plus,
                variant: 'default',
                size: 'icon',
                onClick: () => enterCreate(),
              },
            ]}
          >
            <SearchListEmpty {...dataSetsSearchListEmpty} />
          </SearchList>
        </div>
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSetDetailPanel />
      </div>
    </Page>
  );
}
