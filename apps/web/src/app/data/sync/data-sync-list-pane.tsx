'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { SearchListEmpty } from '@/components/empty-state';
import { SearchList, SearchListItem } from '@/components/search-list';
import {
  listEmptyStateAtom,
  listSearchQueryAtom,
  loadingAtom,
  searchListItemsAtom,
  isEditingAtom,
  selectedIdAtom,
  tasksAtom,
  startCreateAtom,
  selectTaskAtom,
} from '@/models/data-sync/panel.atom';

export function DataSyncListPane() {
  const [listSearchQuery, setListSearchQuery] = useAtom(listSearchQueryAtom);
  const sidebarCollapsed = useAtomValue(isEditingAtom);
  const selectedId = useAtomValue(selectedIdAtom);
  const loading = useAtomValue(loadingAtom);
  const searchListItems = useAtomValue(searchListItemsAtom);
  const syncTasksCount = useAtomValue(tasksAtom).length;
  const listEmptyState = useAtomValue(listEmptyStateAtom);

  const onStartCreate = useSetAtom(startCreateAtom);
  const onSelectItem = useSetAtom(selectTaskAtom);

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
          disabled: loading,
        },
      ]}
    >
      <SearchListEmpty {...listEmptyState} />
    </SearchList>
  );
}
