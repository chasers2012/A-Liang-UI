'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { SearchListEmpty } from '@/components/empty-state';
import { SearchList, SearchListItem } from '@/components/search-list';
import {
  listEmptyStateAtom,
  loadingAtom,
  searchListItemsAtom,
  isEditingAtom,
  selectedIdAtom,
  tasksAtom,
  startCreateAtom,
  selectTaskAtom,
} from '@/models/data-sync/panel.atom';

export function DataSyncListPane() {
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
      searchKeys={['label', 'description', 'id']}
      title="同步任务"
      searchPlaceholder="搜索任务"
      selectedId={sidebarCollapsed ? null : selectedId}
      renderItem={({ item, selectedId }) => (
        <SearchListItem
          item={item}
          selectedId={selectedId}
          title={item.label}
          description={item.description}
          dense
          onClick={() => onSelectItem(item.id)}
        />
      )}
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
