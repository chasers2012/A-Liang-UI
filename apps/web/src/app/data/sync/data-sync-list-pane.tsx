'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { SearchList, SearchListItem } from '@/components/search-list';
import {
  dataSyncDatasourcesAtom,
  dataSyncListNoticeAtom,
  dataSyncListSearchQueryAtom,
  dataSyncLoadingAtom,
  dataSyncSearchListItemsAtom,
  dataSyncSelectedIdAtom,
  dataSyncShowEditorAtom,
  dataSyncSyncTasksAtom,
  startCreateDataSyncAtom,
  selectDataSyncTaskAtom,
} from '@/models/data-sync/panel.atom';

export function DataSyncListPane() {
  const [listSearchQuery, setListSearchQuery] = useAtom(dataSyncListSearchQueryAtom);
  const sidebarCollapsed = useAtomValue(dataSyncShowEditorAtom);
  const selectedId = useAtomValue(dataSyncSelectedIdAtom);
  const loading = useAtomValue(dataSyncLoadingAtom);
  const datasources = useAtomValue(dataSyncDatasourcesAtom);
  const searchListItems = useAtomValue(dataSyncSearchListItemsAtom);
  const syncTasksCount = useAtomValue(dataSyncSyncTasksAtom).length;
  const listNotice = useAtomValue(dataSyncListNoticeAtom);

  const onStartCreate = useSetAtom(startCreateDataSyncAtom);
  const onSelectItem = useSetAtom(selectDataSyncTaskAtom);

  return (
    <SearchList
      className="h-full min-h-0"
      items={loading && syncTasksCount === 0 ? null : searchListItems}
      getGroupKey={(item) => item.category ?? '同步任务'}
      renderTitle={(item) => item.label}
      renderDescription={(item) => item.description}
      getSearchText={(item) => [item.label, item.description ?? '', item.id].join(' ')}
      title="同步任务"
      searchPlaceholder="搜索任务"
      searchQuery={listSearchQuery}
      onSearchQueryChange={setListSearchQuery}
      selectedId={sidebarCollapsed ? null : selectedId}
      renderItem={(p) => <SearchListItem {...p} onItemSelected={(item) => onSelectItem(item.id)} />}
      actions={[
        {
          label: '新增',
          icon: Plus,
          variant: 'default',
          size: 'icon',
          onClick: () => void onStartCreate(),
          disabled: loading || datasources.length < 2,
        },
      ]}
    >
      <p className="p-6 text-sm text-muted-foreground">{listNotice}</p>
    </SearchList>
  );
}
