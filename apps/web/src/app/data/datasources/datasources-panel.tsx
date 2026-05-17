'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import {
  datasourcesListAtoms,
  datasourcesListCountAtom,
  datasourcesListRefreshOnMountEffectAtom,
  datasourcesListSearchQueryAtom,
  cancelDatasourceEditorAtom,
  datasourcesIsEditingAtom,
  datasourcesSearchListRowsAtom,
  datasourcesSelectedIdAtom,
  selectDatasourceFromListAtom,
  startCreateNewDatasourceAtom,
} from '@/models/datasource/panel.atom';

import { DeleteDatasourceDialog } from './ui/delete-datasource-dialog';
import { DatasourceDetailPanel } from './ui/datasource-detail-panel';

function DatasourceListPanel() {
  useAtom(datasourcesListRefreshOnMountEffectAtom);

  const [searchQuery, setSearchQuery] = useAtom(datasourcesListSearchQueryAtom);
  const listItems = useAtomValue(datasourcesSearchListRowsAtom);
  const listError = useAtomValue(datasourcesListAtoms.errorAtom);
  const count = useAtomValue(datasourcesListCountAtom);
  const selectedId = useAtomValue(datasourcesSelectedIdAtom);

  const selectItem = useSetAtom(selectDatasourceFromListAtom);
  const startCreate = useSetAtom(startCreateNewDatasourceAtom);

  const datasourceSearchListEmpty = resolveAsyncListEmptyState({
    loading: listItems == null,
    error: listError ? '数据源列表加载失败。' : null,
    itemCount: count ?? 0,
    emptyTitle: '暂无数据源',
    emptyDescription: '请使用上方「新增数据源」开始配置。',
    filterEmptyDescription: '没有符合当前搜索条件的数据源。',
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {listError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}
      <SearchList
        className="h-full min-h-0"
        items={listItems}
        getGroupKey={(item) => item.category ?? '其他'}
        renderTitle={(item) => item.label}
        renderDescription={() => ''}
        getSearchText={(item) => [item.label, item.category ?? ''].join(' ')}
        title="数据源列表"
        searchPlaceholder="搜索数据源"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedId={selectedId}
        renderItem={(p) => <SearchListItem {...p} onItemSelected={(item) => void selectItem(item.id)} />}
        actions={[
          {
            label: '新增数据源',
            icon: Plus,
            variant: 'default',
            size: 'icon',
            onClick: () => void startCreate(),
          },
        ]}
      >
        <SearchListEmpty {...datasourceSearchListEmpty} />
      </SearchList>
    </div>
  );
}

export function DatasourcesPanel() {
  const isEditing = useAtomValue(datasourcesIsEditingAtom);
  const cancelDatasourceEdit = useSetAtom(cancelDatasourceEditorAtom);

  useNavigationEditGuard(datasourcesIsEditingAtom, {
    onAbandon: () => cancelDatasourceEdit(),
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isEditing} innerWidthClassName="w-[320px]">
        <DatasourceListPanel />
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DatasourceDetailPanel />
      </div>

      <DeleteDatasourceDialog />
    </Page>
  );
}
