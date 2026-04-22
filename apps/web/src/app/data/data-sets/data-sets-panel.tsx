'use client';

import Link from 'next/link';
import { useAtom, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Page } from '@/components/page';
import { getQuantAgentApiBase } from '@/api/client';
import { deleteDataSet } from '@/api/data-sets';
import { cn } from '@/lib/utils';
import {
  dataSetsDeleteTargetAtom,
  dataSetsDeletingAtom,
  dataSetsItemsAtom,
  dataSetsLoadErrorAtom,
  refreshDataSetsAtom,
} from '@/models/data-set/panel-detail.atom';

import { DeleteDataSetDialog } from './ui/delete-data-set-dialog';
import { DataSetTable } from './ui/data-set-table';

export function DataSetsPanel() {
  const [items] = useAtom(dataSetsItemsAtom);
  const [loadError, setLoadError] = useAtom(dataSetsLoadErrorAtom);
  const [deleteTarget, setDeleteTarget] = useAtom(dataSetsDeleteTargetAtom);
  const [deleting, setDeleting] = useAtom(dataSetsDeletingAtom);
  const refresh = useSetAtom(refreshDataSetsAtom);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDataSet(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const count = items?.length ?? 0;

  return (
    <Page
      title="数据集"
      description={
        <>
          配置因子评价的数据源绑定、日期区间与标的池。列表经{' '}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{getQuantAgentApiBase()}</code>
          读写；使用「详情」查看完整字段。
        </>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>已配置的数据集</CardTitle>
          <CardDescription>共 {count} 条；支持多数据源绑定，详情页展示全部存储字段。</CardDescription>
          <CardAction>
            <Link href="/data/data-sets/new" className={cn(buttonVariants(), 'gap-1.5')}>
              <Plus className="size-4" />
              新增数据集
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {items === null && !loadError && <p className="p-6 text-sm text-muted-foreground">加载中…</p>}
          {items && items.length === 0 && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">暂无数据集。请使用上方「新增数据集」开始配置。</p>
          )}
          {items && items.length > 0 && <DataSetTable items={items} onDelete={(t) => setDeleteTarget(t)} />}
        </CardContent>
      </Card>

      <DeleteDataSetDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
