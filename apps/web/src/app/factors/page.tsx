'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemContent } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import {
  cancelFactorEditAtom,
  deleteSelectedFactorAtom,
  factorsBrowseStateAtom,
  factorsCreateModeAtom,
  factorsDefaultSelectedIdAtom,
  factorsEditingAtom,
  factorsEditorLoadErrorAtom,
  factorsEditorLoadingAtom,
  factorsFormAtom,
  factorsFormErrorAtom,
  factorsListAtom,
  factorsListErrorAtom,
  factorsReadonlyAtom,
  factorsSavingAtom,
  factorsSelectedIdAtom,
  filteredFactorsAtom,
  loadFactorEditorAtom,
  refreshFactorsListAtom,
  saveFactorFormAtom,
  setFactorsFormAtom,
  setFactorsSearchQueryAtom,
  startCreateFactorAtom,
  startEditFactorAtom,
} from '@/models/factor';
import { FactorDetailPanel } from './components/panel/factor-detail-panel';

function FactorsListPane() {
  const setSearchQuery = useSetAtom(setFactorsSearchQueryAtom);
  const startCreate = useSetAtom(startCreateFactorAtom);
  const cancelEdit = useSetAtom(cancelFactorEditAtom);
  const [selectedId, setSelectedId] = useAtom(factorsSelectedIdAtom);
  const [editing] = useAtom(factorsEditingAtom);
  const listItems = useAtomValue(factorsListAtom);
  const listError = useAtomValue(factorsListErrorAtom);
  const filteredItems = useAtomValue(filteredFactorsAtom);
  const browseState = useAtomValue(factorsBrowseStateAtom);

  return (
    <SearchList
      className="h-full min-h-0 w-[320px]"
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
          cancelEdit();
        }
      }}
      toolbarRight={
        <button
          type="button"
          aria-label="新增因子"
          className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
          onClick={() => {
            startCreate();
          }}
        >
          <Plus />
        </button>
      }
    />
  );
}

function FactorsDetailPane() {
  const [detailTabValue, setDetailTabValue] = useState('overview');

  const saveForm = useSetAtom(saveFactorFormAtom);
  const setForm = useSetAtom(setFactorsFormAtom);
  const startEdit = useSetAtom(startEditFactorAtom);
  const cancelEdit = useSetAtom(cancelFactorEditAtom);
  const deleteSelected = useSetAtom(deleteSelectedFactorAtom);
  const [selectedId, setSelectedId] = useAtom(factorsSelectedIdAtom);
  const [editing] = useAtom(factorsEditingAtom);
  const readonly = useAtomValue(factorsReadonlyAtom);
  const isCreating = useAtomValue(factorsCreateModeAtom);
  const defaultSelectedId = useAtomValue(factorsDefaultSelectedIdAtom);
  const listItems = useAtomValue(factorsListAtom);
  const form = useAtomValue(factorsFormAtom);
  const formError = useAtomValue(factorsFormErrorAtom);
  const sourceSaving = useAtomValue(factorsSavingAtom);
  const loading = useAtomValue(factorsEditorLoadingAtom);
  const loadError = useAtomValue(factorsEditorLoadErrorAtom);

  const selectedFactor = useMemo(() => {
    if (!selectedId) return null;
    return listItems?.find((m) => m.id === selectedId) ?? null;
  }, [selectedId, listItems]);

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!selectedId && readonly ? (
        <Item variant="outline" className="m-4">
          <ItemContent>
            <p className="text-sm text-muted-foreground">请选择左侧因子后查看详情。</p>
          </ItemContent>
        </Item>
      ) : loading ? (
        <Item variant="outline" className="m-4">
          <ItemContent>
            <p className="text-sm text-muted-foreground">详情加载中…</p>
          </ItemContent>
        </Item>
      ) : loadError ? (
        <Item variant="outline" className="m-4">
          <ItemContent>
            <p className="text-sm text-destructive">详情加载失败：{loadError}</p>
          </ItemContent>
        </Item>
      ) : form ? (
        <FactorDetailPanel
          detailTabValue={detailTabValue}
          setDetailTabValue={setDetailTabValue}
          form={form}
          setForm={setForm}
          formError={formError}
          editing={editing}
          isCreating={isCreating}
          sourceSaving={sourceSaving}
          selectedId={selectedId}
          onCancelCreate={() => {
            cancelEdit();
            setSelectedId(defaultSelectedId);
            setDetailTabValue('overview');
          }}
          onCreate={() => {
            void saveForm();
          }}
          onCancelEdit={() => {
            cancelEdit();
          }}
          onSave={() => {
            void saveForm();
          }}
          onDelete={() => {
            if (!selectedId) return;
            if (!window.confirm(`确定删除因子「${selectedFactor?.name ?? selectedId}」吗？`)) return;
            void deleteSelected().catch((e) => {
              window.alert(e instanceof Error ? e.message : String(e));
            });
          }}
          onEdit={() => {
            setDetailTabValue('overview');
            setSelectedId(selectedId ?? defaultSelectedId);
            startEdit();
          }}
        />
      ) : null}
    </Card>
  );
}

export default function FactorsPage() {
  const refresh = useSetAtom(refreshFactorsListAtom);
  const loadEditor = useSetAtom(loadFactorEditorAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);
  const editing = useAtomValue(factorsEditingAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor, selectedId, editing]);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <FactorsListPane />
      <FactorsDetailPane />
    </Page>
  );
}
