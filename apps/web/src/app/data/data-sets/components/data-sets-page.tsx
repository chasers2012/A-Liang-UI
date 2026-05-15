'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  dataSetsBrowseStateAtom,
  filteredDataSetsAtom,
  setDataSetsSearchQueryAtom,
} from '@/models/data-set/browse.atom';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { handleCancelDataSetEditAtom } from '@/models/data-set/edit.atom';
import {
  dataSetsEnterCreateAtom,
  dataSetsIsEditingAtom,
  dataSetsSelectAndDetailAtom,
} from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

import { DataSetDetailPanel } from './panel/data-set-detail-panel';

/** 所有数据集共用一个分组键，避免按数据源类型拆分（SearchList 不改，仅用 getGroupKey 归组） */
const DATA_SETS_LIST_GROUP_KEY = '数据集';

/** 与 `apps/web/src/app/nodes/page.tsx` 对齐：左列表 + 右卡片，状态全部走 jotai */
export function DataSetsPage() {
  const items = useAtomValue(dataSetAtoms.valueAtom);
  const filteredItems = useAtomValue(filteredDataSetsAtom);
  const { searchQuery } = useAtomValue(dataSetsBrowseStateAtom);
  const setSearchQuery = useSetAtom(setDataSetsSearchQueryAtom);
  const selectedId = useAtomValue(dataSetsSelectedIdAtom);

  const selectDetail = useSetAtom(dataSetsSelectAndDetailAtom);
  const enterCreate = useSetAtom(dataSetsEnterCreateAtom);
  const refreshList = useSetAtom(dataSetAtoms.refreshAtom);
  const listError = useAtomValue(dataSetAtoms.errorAtom);
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const cancelDataSetEdit = useSetAtom(handleCancelDataSetEditAtom);

  useNavigationEditGuard(dataSetsIsEditingAtom, {
    onAbandon: () => void cancelDataSetEdit(),
  });

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onSelectItem = useCallback(
    (item: { id: string }) => {
      selectDetail(item.id);
    },
    [selectDetail],
  );

  const listEmptyMessage =
    (items?.length ?? 0) === 0 ? '暂无数据集。请使用上方「新增数据集」开始配置。' : '没有符合搜索条件的数据集。';

  const dataSetsSearchListNotice = (() => {
    if (listError) return '数据集列表加载失败。';
    if (filteredItems == null) return '加载中…';
    return listEmptyMessage;
  })();

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
              filteredItems?.map((m) => ({
                id: m.id,
                label: m.name,
                description: m.description,
                datasourceType: m.datasource_bindings?.[0]?.datasource_type ?? '',
              })) ?? null
            }
            getGroupKey={() => DATA_SETS_LIST_GROUP_KEY}
            renderTitle={(item) => item.label}
            renderDescription={(item) => item.description ?? ''}
            getSearchText={(item) => [item.label, item.description ?? '', item.datasourceType].join(' ')}
            title="数据集列表"
            searchPlaceholder="搜索数据集"
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            selectedId={selectedId}
            renderItem={(p) => <SearchListItem {...p} onItemSelected={onSelectItem} />}
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
            <p className="p-6 text-sm text-muted-foreground">{dataSetsSearchListNotice}</p>
          </SearchList>
        </div>
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSetDetailPanel />
      </div>
    </Page>
  );
}
