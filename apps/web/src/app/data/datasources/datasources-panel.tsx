'use client';

import Link from 'next/link';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Page } from '@/components/page';
import { ApiError, getQuantAgentApiBase } from '@/api/client';
import { testDatasource } from '@/api/datasources';
import type { DataSourcePublic } from '@/models/datasource/dto';
import { cn } from '@/lib/utils';
import {
  confirmDeleteDatasourceAtom,
  datasourcesBusyIdAtom,
  datasourcesDeleteErrorAtom,
  datasourcesDeleteTargetAtom,
  datasourcesDeletingAtom,
  datasourcesListAtoms,
  datasourcesTestHintAtom,
} from '@/models/datasource/panel.atom';

import { DatasourceTable } from './ui/datasource-table';
import { DeleteDatasourceDialog } from './ui/delete-datasource-dialog';

export function DatasourcesPanel() {
  const [busyId, setBusyId] = useAtom(datasourcesBusyIdAtom);
  const [testHint, setTestHint] = useAtom(datasourcesTestHintAtom);
  const [deleteTarget, setDeleteTarget] = useAtom(datasourcesDeleteTargetAtom);
  const deleting = useAtomValue(datasourcesDeletingAtom);
  const items = useAtomValue(datasourcesListAtoms.valueAtom);
  const loadError = useAtomValue(datasourcesListAtoms.errorAtom);
  const deleteError = useAtomValue(datasourcesDeleteErrorAtom);
  const confirmDelete = useSetAtom(confirmDeleteDatasourceAtom);
  const refresh = useSetAtom(datasourcesListAtoms.refreshAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return (
    <Page
      title="数据源"
      description={
        <>
          配置经 <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{getQuantAgentApiBase()}</code>
          读写，落盘于服务端 workspace（
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">QUANT_AGENT_WORKSPACE</code>
          ，默认 <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">~/.quant-agent</code>
          ）。使用「详情」查看完整配置。
        </>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {deleteError && (
        <Alert variant="destructive">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {testHint && (
        <Alert variant={testHint.ok ? 'default' : 'destructive'}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>已配置的数据源</CardTitle>
          <CardDescription>共 {count} 条；可测试连接或编辑配置。</CardDescription>
          <CardAction>
            <Link href="/data/datasources/new" className={cn(buttonVariants(), 'gap-1.5')}>
              <Plus className="size-4" />
              新增数据源
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {items === null && !loadError && <p className="p-6 text-sm text-muted-foreground">加载中…</p>}
          {items && items.length === 0 && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">暂无数据源。请使用上方「新增数据源」开始配置。</p>
          )}
          {items && items.length > 0 && (
            <DatasourceTable items={items} busyId={busyId} onTest={runTest} onDelete={(ds) => setDeleteTarget(ds)} />
          )}
        </CardContent>
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
