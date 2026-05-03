'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Pencil } from 'lucide-react';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import { cn } from '@/lib/utils';
import {
  deleteStrategyAtomFamily,
  loadStrategyDetailAtomFamily,
  refreshStrategyNodeTypesAtom,
  strategyDetailAtomFamily,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';
import { NodeSummaryPublic } from '@/models/nodes/dto';
import type { StrategyPublic } from '@/models/strategy/dto';

function StrategyDetailContent(props: {
  id: string;
  data: StrategyPublic | null;
  error: string | null;
  catalog: NodeSummaryPublic[] | null;
  catalogError: string | null;
  deleting: boolean;
  deleteError: string | null;
  onDelete: () => void;
}) {
  const { id, data, error, catalog, catalogError, deleting, deleteError, onDelete } = props;
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog ?? []), [catalog]);
  const catalogLoading = !catalog && !catalogError;
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (error || !data) {
    return (
      <Page>
        <Alert variant={error ? 'destructive' : 'default'}>
          <AlertTitle>{error ? '加载失败' : '加载中…'}</AlertTitle>
          {error ? <AlertDescription>{error}</AlertDescription> : null}
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title={data.name}
      description={data.description || '无描述'}
      className="max-w-full"
      gap="sm"
      action={
        <div className="flex items-center gap-2">
          <Link
            href={`/strategies/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}
          >
            <Pencil className="size-4" />
            编辑
          </Link>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => setDeleteOpen(true)}>
            {deleting ? '删除中…' : '删除'}
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除策略？</AlertDialogTitle>
                <AlertDialogDescription>删除后不可恢复，相关回测引用也可能失效。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteOpen(false);
                    onDelete();
                  }}
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      {deleteError && (
        <Alert variant="destructive">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
      {catalogLoading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : catalogError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      ) : (
        <WorkflowGraphCanvas
          key={data.updated_at}
          nodeTypes={nodeTypes}
          initialGraph={data.workflow}
          readOnly
          className="flex-1 w-full"
        />
      )}
    </Page>
  );
}

export default function StrategyDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const invalidId = !id || id === 'undefined';
  const { row: data, error } = useAtomValue(strategyDetailAtomFamily(id ?? ''));
  const loadDetail = useSetAtom(loadStrategyDetailAtomFamily(id ?? ''));
  const deleteStrategy = useSetAtom(deleteStrategyAtomFamily(id ?? ''));
  const { items: catalog, error: catalogError } = useAtomValue(strategyNodeTypesAtom);
  const refreshCatalog = useSetAtom(refreshStrategyNodeTypesAtom);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    void loadDetail();
  }, [invalidId, loadDetail]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  if (invalidId) {
    return (
      <Page>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </Page>
    );
  }

  const handleDelete = () => {
    if (deleting) return;
    setDeleteError(null);
    setDeleting(true);
    void deleteStrategy()
      .then(() => {
        router.push('/strategies');
      })
      .catch((e) => {
        setDeleteError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  return (
    <StrategyDetailContent
      id={id}
      data={data}
      error={error}
      catalog={catalog}
      catalogError={catalogError}
      deleting={deleting}
      deleteError={deleteError}
      onDelete={handleDelete}
    />
  );
}
