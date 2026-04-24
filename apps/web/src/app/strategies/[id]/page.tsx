'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Pencil } from 'lucide-react';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import { cn } from '@/lib/utils';
import {
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
}) {
  const { id, data, error, catalog, catalogError } = props;
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog ?? []), [catalog]);
  const catalogLoading = !catalog && !catalogError;

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
        <Link
          href={`/strategies/${encodeURIComponent(id)}/edit`}
          className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}
        >
          <Pencil className="size-4" />
          编辑
        </Link>
      }
    >
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
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const invalidId = !id || id === 'undefined';
  const { row: data, error } = useAtomValue(strategyDetailAtomFamily(id ?? ''));
  const loadDetail = useSetAtom(loadStrategyDetailAtomFamily(id ?? ''));
  const { items: catalog, error: catalogError } = useAtomValue(strategyNodeTypesAtom);
  const refreshCatalog = useSetAtom(refreshStrategyNodeTypesAtom);

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

  return <StrategyDetailContent id={id} data={data} error={error} catalog={catalog} catalogError={catalogError} />;
}
