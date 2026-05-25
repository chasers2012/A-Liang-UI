'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
import { SearchList, SearchListItem } from '@/components/search-list';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { listAtoms, refreshNodeTypesAtom } from '@/models/evaluation-profile/list-detail.atom';
import {
  cancelEditorAtom,
  isEditingAtom,
  selectedIdAtom,
  selectProfileAtom,
  startCreateAtom,
} from '@/models/evaluation-profile/scope.atom';

import { EvaluationProfileDetailPanel } from './ui/evaluation-profile-detail-panel';

export default function EvaluationProfilesPage() {
  const items = useAtomValue(listAtoms.valueAtom);
  const refreshList = useSetAtom(listAtoms.refreshAtom);
  const refreshNodeTypes = useSetAtom(refreshNodeTypesAtom);

  const selectedId = useAtomValue(selectedIdAtom);
  const isEditing = useAtomValue(isEditingAtom);
  const setPanelSelectedId = useSetAtom(selectedIdAtom);
  const selectItem = useSetAtom(selectProfileAtom);
  const startCreate = useSetAtom(startCreateAtom);
  const cancelEdit = useSetAtom(cancelEditorAtom);

  useNavigationEditGuard(isEditingAtom, {
    onAbandon: () => cancelEdit(),
  });

  const listSelectedId = isEditing && selectedId == null ? null : selectedId;

  useLayoutEffect(() => {
    if (!items?.length || isEditing) return;
    if (selectedId == null || !items.some((x) => x.id === selectedId)) {
      setPanelSelectedId(items[0].id);
    }
  }, [items, selectedId, isEditing, setPanelSelectedId]);

  useEffect(() => {
    void refreshList();
    void refreshNodeTypes();
  }, [refreshList, refreshNodeTypes]);

  const sidebarItems = useMemo(() => items?.map((p) => ({ ...p, category: '评价方案' })) ?? null, [items]);

  const evaluationProfilesSearchListEmpty = resolveAsyncListEmptyState({
    loading: items == null,
    itemCount: items?.length ?? 0,
    emptyTitle: '暂无评价方案',
    emptyDescription: '请使用上方「新增方案」开始配置。',
    filterEmptyDescription: '没有符合当前筛选条件的评价方案。',
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSidebar collapsed={isEditing} drawerTitle="评价方案">
        <SearchList
          className="h-full min-h-0"
          items={sidebarItems}
          getGroupKey={(item) => item.category}
          searchKeys={['name', 'description', 'id']}
          title="评价方案列表"
          searchPlaceholder="搜索评价方案"
          selectedId={listSelectedId}
          renderItem={({ item, selectedId }) => (
            <SearchListItem
              item={item}
              selectedId={selectedId}
              title={item.name}
              description={item.description ?? ''}
              onClick={() => void selectItem(item.id)}
            />
          )}
          actions={[
            {
              label: '新增评价方案',
              icon: Plus,
              variant: 'default',
              size: 'icon',
              onClick: () => void startCreate(),
            },
          ]}
        >
          <SearchListEmpty {...evaluationProfilesSearchListEmpty} />
        </SearchList>
      </CollapsibleSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EvaluationProfileDetailPanel />
      </div>
    </Page>
  );
}
