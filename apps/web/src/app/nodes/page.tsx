'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { NodeSummaryPublic } from '@/models/nodes/dto';
import {
  nodesDomainConfigsAtom,
  filteredNodesAtom,
  nodesBrowseStateAtom,
  nodesDefaultSelectedIdAtom,
  nodesSelectedIdAtom,
  nodesSelectedDomainsAtom,
  setNodesSearchQueryAtom,
} from '@/models/nodes/browse.atom';
import { nodesListAtom } from '@/models/nodes/list-detail.atom';
import { NodesListFilterPopover } from './components/nodes-list-filter-popover';
import { NodesNodeDetailPanel } from './components/panel/node-detail-panel';

function getNodesEffectiveSelectedId(params: {
  selectedDomains: string[];
  defaultSelectedId: string | null;
  domainDefaultSelectedId: string | null;
}): string | null {
  const { selectedDomains, defaultSelectedId, domainDefaultSelectedId } = params;
  if (selectedDomains.length === 0) return defaultSelectedId;
  return domainDefaultSelectedId;
}

function parseNodesBrowseQuery(params: URLSearchParams): { isCreate: boolean } {
  const isCreate = params.get('new') === '1';
  return { isCreate };
}

export default function NodesPage() {
  const searchParams = useSearchParams();
  const items = useAtomValue(nodesListAtom);
  const { searchQuery } = useAtomValue(nodesBrowseStateAtom);
  const filteredItems = useAtomValue(filteredNodesAtom);
  const defaultSelectedId = useAtomValue(nodesDefaultSelectedIdAtom);
  const domainConfigs = useAtomValue(nodesDomainConfigsAtom);
  const [selectedDomains] = useAtom(nodesSelectedDomainsAtom);
  const [selectedId, setSelectedId] = useAtom(nodesSelectedIdAtom);
  const setSearchQuery = useSetAtom(setNodesSearchQueryAtom);

  const { isCreate } = useMemo(() => parseNodesBrowseQuery(searchParams), [searchParams]);
  const domainFilteredItems = useMemo(() => {
    if (!filteredItems) return null;
    if (selectedDomains.length === 0) return filteredItems;
    return filteredItems.filter((m: NodeSummaryPublic) => {
      return selectedDomains.some((domain) => {
        const hidden = domainConfigs[domain];
        if (!hidden) return true;
        return !hidden.has(m.id);
      });
    });
  }, [domainConfigs, filteredItems, selectedDomains]);

  /** `/nodes` 无 URL id 时，右侧与列表高亮均对齐当前筛选结果的第一条。 */
  const effectiveDefaultSelectedId = domainFilteredItems?.[0]?.id ?? null;
  const effectiveSelectedId = getNodesEffectiveSelectedId({
    selectedDomains,
    defaultSelectedId,
    domainDefaultSelectedId: effectiveDefaultSelectedId,
  });
  const nodeId = isCreate ? null : (selectedId ?? effectiveSelectedId);
  const highlightId = isCreate ? null : nodeId;

  useEffect(() => {
    if (isCreate) return;
    const nextSelectedId = selectedId ?? effectiveSelectedId;
    if (nextSelectedId !== selectedId) {
      setSelectedId(nextSelectedId);
    }
  }, [effectiveSelectedId, isCreate, selectedId, setSelectedId]);

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
          domainFilteredItems?.map((m) => ({
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
        selectedId={highlightId}
        emptyText={
          (items?.length ?? 0) === 0 ? '暂无节点。请使用上方「新增节点」开始配置。' : '没有符合当前筛选条件的节点。'
        }
        onItemSelected={onSelectNode}
        toolbarRight={
          <>
            <NodesListFilterPopover />
            <Link
              href="/nodes?new=1"
              aria-label="新增节点"
              className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
            >
              <Plus />
            </Link>
          </>
        }
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NodesNodeDetailPanel nodeId={nodeId} createMode={isCreate} />
      </Card>
    </Page>
  );
}
