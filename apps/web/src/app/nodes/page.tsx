'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useCallback } from 'react';

import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { filteredNodesAtom, nodesBrowseStateAtom, setNodesSearchQueryAtom } from '@/models/nodes/browse.atom';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';
import { nodesCreateModeAtom } from '@/models/nodes/edit.atom';
import { nodesListAtom } from '@/models/nodes/list-detail.atom';
import { NodesListFilterPopover } from './components/nodes-list-filter-popover';
import { NodesNodeDetailPanel } from './components/panel/node-detail-panel';

export default function NodesPage() {
  const items = useAtomValue(nodesListAtom);
  const { searchQuery } = useAtomValue(nodesBrowseStateAtom);
  const filteredItems = useAtomValue(filteredNodesAtom);
  const setIsCreate = useSetAtom(nodesCreateModeAtom);
  const [selectedId, setSelectedId] = useAtom(nodesSelectedIdAtom);
  const setSearchQuery = useSetAtom(setNodesSearchQueryAtom);

  const onSelectNode = useCallback(
    (item: { id: string }) => {
      setSelectedId(item.id);
    },
    [setSelectedId],
  );

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <SearchList
        className="h-full min-h-0 w-[300px]"
        items={
          filteredItems?.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            category: m.category,
          })) ?? null
        }
        getGroupKey={(item) => item.category ?? '其他'}
        renderTitle={(item) => item.label}
        renderDescription={(item) => item.description ?? ''}
        getSearchText={(item) => [item.label, item.description ?? '', item.category ?? ''].join(' ')}
        title="节点列表"
        searchPlaceholder="搜索节点"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedId={selectedId}
        emptyText={
          (items?.length ?? 0) === 0 ? '暂无节点。请使用上方「新增节点」开始配置。' : '没有符合当前筛选条件的节点。'
        }
        onItemSelected={onSelectNode}
        toolbarRight={
          <>
            <NodesListFilterPopover />
            <Button
              type="button"
              aria-label="新增节点"
              className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
              onClick={() => setIsCreate(true)}
            >
              <Plus />
            </Button>
          </>
        }
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NodesNodeDetailPanel />
      </Card>
    </Page>
  );
}
