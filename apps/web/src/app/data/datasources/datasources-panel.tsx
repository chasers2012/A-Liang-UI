'use client';

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { ApiError } from '@/api/client';
import { testDatasource } from '@/api/datasources';
import type { DataSourcePublic } from '@/models/datasource/dto';
import {
  confirmDeleteDatasourceAtom,
  datasourcesBusyIdAtom,
  datasourcesDeleteErrorAtom,
  datasourcesDeleteTargetAtom,
  datasourcesDeletingAtom,
  datasourcesListAtoms,
  datasourcesTestHintAtom,
} from '@/models/datasource/panel.atom';

import { DeleteDatasourceDialog } from './ui/delete-datasource-dialog';
import { DatasourceDetailPanel } from './ui/datasource-detail-panel';

export function DatasourcesPanel({ initialSelectedId }: { initialSelectedId?: string | null }) {
  const [busyId, setBusyId] = useAtom(datasourcesBusyIdAtom);
  const [testHint, setTestHint] = useAtom(datasourcesTestHintAtom);
  const [deleteTarget, setDeleteTarget] = useAtom(datasourcesDeleteTargetAtom);
  const deleting = useAtomValue(datasourcesDeletingAtom);
  const items = useAtomValue(datasourcesListAtoms.valueAtom);
  const loadError = useAtomValue(datasourcesListAtoms.errorAtom);
  const deleteError = useAtomValue(datasourcesDeleteErrorAtom);
  const confirmDelete = useSetAtom(confirmDeleteDatasourceAtom);
  const refresh = useSetAtom(datasourcesListAtoms.refreshAtom);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId && initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedId]);

  useEffect(() => {
    if (mode !== 'create') return;
    setSelectedId(null);
  }, [mode]);

  const runTest = async (ds: DataSourcePublic) => {
    setBusyId(ds.id);
    setTestHint(null);
    try {
      const r = await testDatasource(ds.id);
      setTestHint({ id: ds.id, ok: r.ok, message: r.message });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setTestHint({ id: ds.id, ok: false, message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const count = items?.length ?? 0;

  const listItems = useMemo(() => {
    return (
      items?.map((ds) => ({
        id: ds.id,
        label: ds.name,
        description: null,
        category: ds.type,
      })) ?? null
    );
  }, [items]);

  const onSelectDatasource = useCallback(
    (item: { id: string }) => {
      setSelectedId(item.id);
      setMode('view');
    },
    [setSelectedId],
  );

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <SearchList
        className="h-full min-h-0 w-[300px]"
        items={listItems}
        getGroupKey={(item) => item.category ?? '其他'}
        renderTitle={(item) => item.label}
        renderDescription={() => ''}
        getSearchText={(item) => [item.label, item.category ?? ''].join(' ')}
        title="数据源列表"
        searchPlaceholder="搜索数据源"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedId={mode === 'create' ? null : selectedId}
        emptyText={
          (count ?? 0) === 0 ? '暂无数据源。请使用上方「新增数据源」开始配置。' : '没有符合当前搜索条件的数据源。'
        }
        onItemSelected={onSelectDatasource}
        toolbarRight={
          <Button
            type="button"
            aria-label="新增数据源"
            size="icon"
            onClick={() => {
              setMode('create');
              setSelectedId(null);
            }}
          >
            <Plus />
          </Button>
        }
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DatasourceDetailPanel
          items={items}
          selectedId={selectedId}
          mode={mode}
          busyId={busyId}
          listError={loadError}
          deleteError={deleteError}
          testHint={testHint}
          onModeChange={setMode}
          onSelectId={setSelectedId}
          onRefreshList={() => refresh()}
          onRunTest={runTest}
          onDelete={(ds) => setDeleteTarget(ds)}
        />
      </Card>

      <DeleteDatasourceDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
