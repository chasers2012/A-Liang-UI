'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';

import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  creatingAtom,
  factorsBrowseStateAtom,
  factorsListAtoms,
  factorsEditingAtom,
  factorsSelectedIdAtom,
  filteredFactorsAtom,
  setFactorsSearchQueryAtom,
} from '@/models/factor';
import { FactorDetailPanel } from './components/panel/factor-detail-panel';

function FactorsListPane() {
  const setSearchQuery = useSetAtom(setFactorsSearchQueryAtom);
  const startCreate = useSetAtom(creatingAtom);
  const setEditing = useSetAtom(factorsEditingAtom);
  const [selectedId, setSelectedId] = useAtom(factorsSelectedIdAtom);
  const [editing] = useAtom(factorsEditingAtom);
  const listItems = useAtomValue(factorsListAtoms.valueAtom);
  const listError = useAtomValue(factorsListAtoms.errorAtom);
  const filteredItems = useAtomValue(filteredFactorsAtom);
  const browseState = useAtomValue(factorsBrowseStateAtom);

  return (
    <CollapsibleSearchListSidebar collapsed={editing} innerWidthClassName="w-[320px]">
      <SearchList
        className="h-full min-h-0"
        items={
          filteredItems?.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            category: m.group,
          })) ?? null
        }
        getGroupKey={(item) => item.category ?? '未分组'}
        renderTitle={(item) => item.label}
        renderDescription={(item) => item.description ?? ''}
        getSearchText={(item) => [item.label, item.description ?? '', item.category ?? '', item.id].join(' ')}
        title="因子列表"
        searchPlaceholder="搜索因子"
        searchQuery={browseState.searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedId={selectedId}
        emptyText={
          listError
            ? '因子列表加载失败。'
            : (listItems?.length ?? 0) === 0
              ? '暂无因子。请使用右上角「新增因子」创建。'
              : '没有符合当前筛选条件的因子。'
        }
        onItemSelected={(item) => {
          setSelectedId(item.id);
          if (editing) {
            setEditing(false);
          }
        }}
        toolbarRight={
          <button
            type="button"
            aria-label="新增因子"
            className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
            onClick={() => {
              startCreate(true);
            }}
          >
            <Plus />
          </button>
        }
      />
    </CollapsibleSearchListSidebar>
  );
}

export default function FactorsPage() {
  const refreshList = useSetAtom(factorsListAtoms.refreshAtom);
  const abandonFactorEdit = useSetAtom(factorsEditingAtom);

  useNavigationEditGuard(factorsEditingAtom, {
    onAbandon: () => {
      void abandonFactorEdit(false);
    },
  });

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <FactorsListPane />
      <FactorDetailPanel />
    </Page>
  );
}
