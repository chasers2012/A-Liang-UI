'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';

import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { creatingAtom, factorsListAtoms, factorsEditingAtom, factorsSelectedIdAtom } from '@/models/factor';
import { FactorDetailPanel } from './components/panel/factor-detail-panel';

function FactorsListPane() {
  const startCreate = useSetAtom(creatingAtom);
  const setEditing = useSetAtom(factorsEditingAtom);
  const [selectedId, setSelectedId] = useAtom(factorsSelectedIdAtom);
  const [editing] = useAtom(factorsEditingAtom);
  const listItems = useAtomValue(factorsListAtoms.valueAtom);
  const listError = useAtomValue(factorsListAtoms.errorAtom);

  const factorsSearchListEmpty = resolveAsyncListEmptyState({
    loading: listItems == null,
    error: listError ? '因子列表加载失败。' : null,
    itemCount: listItems?.length ?? 0,
    emptyTitle: '暂无因子',
    emptyDescription: '请使用右上角「新增因子」创建。',
    filterEmptyDescription: '没有符合当前筛选条件的因子。',
  });

  return (
    <CollapsibleSearchListSidebar collapsed={editing} innerWidthClassName="w-[320px]">
      <SearchList
        className="h-full min-h-0"
        items={
          listItems?.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            category: m.group,
          })) ?? null
        }
        getGroupKey={(item) => item.category ?? '未分组'}
        searchKeys={['label', 'description', 'category', 'id']}
        title="因子列表"
        searchPlaceholder="搜索因子"
        selectedId={selectedId}
        renderItem={({ item, selectedId }) => (
          <SearchListItem
            item={item}
            selectedId={selectedId}
            title={item.label}
            description={item.description ?? ''}
            onClick={() => {
              setSelectedId(item.id);
              if (editing) {
                setEditing(false);
              }
            }}
          />
        )}
        actions={[
          {
            label: '新增因子',
            icon: Plus,
            variant: 'default',
            size: 'icon',
            onClick: () => {
              startCreate(true);
            },
          },
        ]}
      >
        <SearchListEmpty {...factorsSearchListEmpty} />
      </SearchList>
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
