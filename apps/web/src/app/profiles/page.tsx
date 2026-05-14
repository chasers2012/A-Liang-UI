'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/page';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { SearchList } from '@/components/search-list';
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

function listEmptyText(itemCount: number): string {
  if (itemCount === 0) return '暂无评价方案。请使用上方「新增方案」开始配置。';
  return '没有符合当前筛选条件的评价方案。';
}

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

  const emptyText = listEmptyText(items?.length ?? 0);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={isEditing} innerWidthClassName="w-[320px]">
        <SearchList
          className="h-full min-h-0"
          items={sidebarItems}
          getGroupKey={(item) => item.category}
          renderTitle={(item) => item.name}
          renderDescription={(item) => item.description ?? ''}
          getSearchText={(item) => [item.name, item.description ?? '', item.id].join(' ')}
          title="评价方案列表"
          searchPlaceholder="搜索评价方案"
          selectedId={listSelectedId}
          emptyText={emptyText}
          loadingText="加载中…"
          onItemSelected={(item) => void selectItem(item.id)}
          toolbarRight={
            <Button
              type="button"
              variant="default"
              size="icon"
              aria-label="新增评价方案"
              onClick={() => void startCreate()}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          }
        />
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EvaluationProfileDetailPanel />
      </div>
    </Page>
  );
}
