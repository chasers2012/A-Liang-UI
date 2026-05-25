'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { NodesListFilterPopover } from './components/nodes-list-filter-popover';
import { filteredNodesAtom } from '@/models/nodes/browse.atom';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';
import { handleCancelNodesEditAtom, nodesCreateModeAtom, nodesEditActiveAtom } from '@/models/nodes/edit.atom';
import { nodesListAtoms } from '@/models/nodes/list-detail.atom';
import { NodesNodeDetailPanel } from './components/panel/node-detail-panel';

export default function NodesPage() {
  const items = useAtomValue(nodesListAtoms.valueAtom);
  const filteredItems = useAtomValue(filteredNodesAtom);
  const setIsCreate = useSetAtom(nodesCreateModeAtom);
  const isEditActive = useAtomValue(nodesEditActiveAtom);
  const [selectedId, setSelectedId] = useAtom(nodesSelectedIdAtom);
  const refreshList = useSetAtom(nodesListAtoms.refreshAtom);
  const cancelNodesEdit = useSetAtom(handleCancelNodesEditAtom);

  useNavigationEditGuard(nodesEditActiveAtom, {
    onAbandon: () => cancelNodesEdit(),
  });

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onSelectNode = useCallback(
    (item: { id: string }) => {
      setSelectedId(item.id);
    },
    [setSelectedId],
  );

  const nodesSearchListEmpty = resolveAsyncListEmptyState({
    loading: filteredItems == null,
    itemCount: items?.length ?? 0,
    emptyTitle: '暂无节点',
    emptyDescription: '请使用上方「新增节点」开始配置。',
    filterEmptyDescription: '没有符合当前筛选条件的节点。',
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSidebar collapsed={isEditActive} drawerTitle="节点">
        <SearchList
          className="h-full min-h-0"
          items={
            filteredItems?.map((m) => ({
              id: m.id,
              label: m.name,
              description: m.desc,
              category: m.category,
            })) ?? null
          }
          getGroupKey={(item) => item.category ?? '其他'}
          searchKeys={['label', 'description', 'category']}
          title="节点列表"
          searchPlaceholder="搜索节点"
          selectedId={selectedId}
          renderItem={({ item, selectedId }) => (
            <SearchListItem
              item={item}
              selectedId={selectedId}
              title={item.label}
              description={item.description ?? ''}
              onClick={() => onSelectNode(item)}
            />
          )}
          actions={[
            { label: '筛选节点', render: () => <NodesListFilterPopover /> },
            {
              label: '新增节点',
              icon: Plus,
              variant: 'default',
              size: 'icon',
              onClick: () => setIsCreate(true),
            },
          ]}
        >
          <SearchListEmpty {...nodesSearchListEmpty} />
        </SearchList>
      </CollapsibleSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NodesNodeDetailPanel />
      </div>
    </Page>
  );
}
