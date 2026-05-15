'use client';

import { Plus } from 'lucide-react';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { SearchList, SearchListItem } from '@/components/search-list';
import type { DataSourcePublic } from '@/models/datasource/dto';

export type DataSyncListPaneProps = {
  sidebarCollapsed: boolean;
  selectedId: string | null;
  listSearchQuery: string;
  onListSearchQueryChange: (q: string) => void;
  loading: boolean;
  datasources: DataSourcePublic[];
  searchListItems: Array<{ id: string; label: string; description: string; category: string }>;
  syncTasksCount: number;
  listNotice: string;
  onStartCreate: () => void;
  onSelectItem: (id: string) => void;
};

export function DataSyncListPane(props: DataSyncListPaneProps) {
  const {
    sidebarCollapsed,
    selectedId,
    listSearchQuery,
    onListSearchQueryChange,
    loading,
    datasources,
    searchListItems,
    syncTasksCount,
    listNotice,
    onStartCreate,
    onSelectItem,
  } = props;

  return (
    <CollapsibleSearchListSidebar collapsed={sidebarCollapsed} innerWidthClassName="w-[320px]">
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
        onSearchQueryChange={onListSearchQueryChange}
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
    </CollapsibleSearchListSidebar>
  );
}
