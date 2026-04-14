'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WorkflowGraphCanvas, type WorkflowNodeTypeDefinition } from '@/components/workflow-graph';
import type { StrategyNodeTypeCatalogItemPublic } from '@/models';
import {
  deleteStrategyAtomFamily,
  loadStrategyDetailAtomFamily,
  refreshStrategyNodeTypesAtom,
  strategyDetailAtomFamily,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';

function toWorkflowNodeTypes(catalog: StrategyNodeTypeCatalogItemPublic[]): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    type: c.type,
    label: c.label,
    description: c.description,
    category: c.category ?? undefined,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}

function StrategyDetailContent({
  id,
  data,
  error,
  catalog,
  catalogError,
  deleting,
  onDelete,
}: {
  id: string | undefined;
  data: { name: string; description?: string | null; workflow: unknown; updated_at: string } | null;
  error: string | null;
  catalog: StrategyNodeTypeCatalogItemPublic[] | null;
  catalogError: string | null;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog ?? []), [catalog]);
  const catalogLoading = !catalog && !catalogError;

  if (!data && !error) {
    return (
      <Page title="策略">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="策略">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error ?? '未知错误'}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title={data.name}
      description={data.description || '策略详情'}
      action={
        <div className="flex items-center gap-2">
          {id && id !== 'undefined' ? (
            <Link href={`/strategies/${encodeURIComponent(id)}/edit`} className={cn(buttonVariants({ variant: 'default' }))}>
              编辑
            </Link>
          ) : null}
          <Button type="button" variant="destructive" onClick={() => void onDelete()} disabled={deleting}>
            删除
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>工作流</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogLoading ? (
            <p className="text-sm text-muted-foreground">加载节点类型…</p>
          ) : catalogError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{catalogError}</AlertDescription>
            </Alert>
          ) : (
            <WorkflowGraphCanvas key={data.updated_at} nodeTypes={nodeTypes} initialGraph={data.workflow} readOnly className="h-[560px] w-full" />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default function StrategyDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const invalidId = !id || id === 'undefined';
  const { row: data, error } = useAtomValue(strategyDetailAtomFamily(id ?? ''));
  const loadDetail = useSetAtom(loadStrategyDetailAtomFamily(id ?? ''));
  const doDelete = useSetAtom(deleteStrategyAtomFamily(id ?? ''));
  const { items: catalog, error: catalogError } = useAtomValue(strategyNodeTypesAtom);
  const refreshCatalog = useSetAtom(refreshStrategyNodeTypesAtom);

  useEffect(() => {
    if (invalidId) return;
    void loadDetail();
  }, [invalidId, loadDetail]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const onDelete = async () => {
    setDeleting(true);
    try {
      if (!id || id === 'undefined') throw new Error('无效策略 ID');
      await doDelete();
      router.push('/strategies');
    } finally {
      setDeleting(false);
    }
  };

  return <StrategyDetailContent id={id} data={data} error={error} catalog={catalog} catalogError={catalogError} deleting={deleting} onDelete={onDelete} />;
}
