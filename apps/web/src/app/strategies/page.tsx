'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useSearchParams } from 'next/navigation';

import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
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
import { buttonVariants } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import { cn } from '@/lib/utils';
import {
  deleteStrategyAtomFamily,
  loadStrategyDetailAtomFamily,
  refreshStrategyNodeTypesAtom,
  strategiesListAtoms,
  strategyDetailAtomFamily,
  strategyNodeTypesAtom,
} from '@/models/strategy/list-detail.atom';

function getEmptyText(error: string | null, itemCount: number): string {
  if (error) return '策略列表加载失败。';
  if (itemCount === 0) return '暂无策略。请使用右上角「新增策略」创建。';
  return '没有符合当前筛选条件的策略。';
}

function buildStrategyDetailPanels(args: {
  error: string | null;
  nodeCatalogError: string | null;
  deleteError: string | null;
  showEmpty: boolean;
  description: string;
  detailRow: { updated_at: string; workflow: unknown } | null;
  nodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
}) {
  const { error, nodeCatalogError, deleteError, showEmpty, description, detailRow, nodeTypes } = args;

  const header = (
    <>
      <DetailStatusAlerts detailError={error} nodeCatalogError={nodeCatalogError} />
      {deleteError ? (
        <Alert variant="destructive">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      ) : null}
      {showEmpty ? (
        <Alert>
          <AlertDescription>请选择左侧策略后查看详情。</AlertDescription>
        </Alert>
      ) : null}
    </>
  );

  return [
    {
      value: 'description',
      label: '描述',
      content: (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {header}
          {!showEmpty ? (
            <div className="rounded-md border bg-card p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">
              {description || '无描述'}
            </div>
          ) : null}
        </div>
      ),
      contentClassName: 'overflow-y-auto',
    },
    {
      value: 'workflow',
      label: '工作流',
      content: (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {header}
          {!showEmpty ? (
            detailRow && !nodeCatalogError ? (
              <WorkflowGraphCanvas
                key={detailRow.updated_at}
                nodeTypes={nodeTypes}
                initialGraph={detailRow.workflow as never}
                readOnly
                className="flex-1 w-full"
              />
            ) : (
              <Alert>
                <AlertDescription>暂无可展示的工作流。</AlertDescription>
              </Alert>
            )
          ) : null}
        </div>
      ),
      contentClassName: 'overflow-hidden',
    },
  ] as const;
}

function StrategyDetailPane(props: {
  selectedId: string | null;
  nodeCatalogError: string | null;
  nodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
  onDeleted: () => void;
}) {
  const { selectedId, nodeCatalogError, nodeTypes, onDeleted } = props;
  const { row, error } = useAtomValue(strategyDetailAtomFamily(selectedId ?? ''));
  const loadDetail = useSetAtom(loadStrategyDetailAtomFamily(selectedId ?? ''));
  const deleteStrategy = useSetAtom(deleteStrategyAtomFamily(selectedId ?? ''));
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail();
  }, [selectedId, loadDetail]);

  const title = row?.name ?? '策略详情';
  const description = row?.description || '无描述';
  const showEmpty = !selectedId || (!row && !error);
  const detailRow = row;
  const handleDelete = () => {
    if (!selectedId || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    void deleteStrategy()
      .then(() => {
        onDeleted();
      })
      .catch((e) => {
        setDeleteError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  return (
    <PanelDetailCard
      title={title}
      actions={
        <DetailActions
          selectedId={selectedId}
          deleting={deleting}
          deleteOpen={deleteOpen}
          onDeleteOpenChange={setDeleteOpen}
          onConfirmDelete={handleDelete}
        />
      }
      panels={buildStrategyDetailPanels({
        error,
        nodeCatalogError,
        deleteError,
        showEmpty,
        description,
        detailRow,
        nodeTypes,
      })}
    />
  );
}

function DetailActions(props: {
  selectedId: string | null;
  deleting: boolean;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
}) {
  const { selectedId, deleting, deleteOpen, onDeleteOpenChange, onConfirmDelete } = props;
  if (!selectedId) return null;
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/strategies/${encodeURIComponent(selectedId)}/edit`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        编辑策略
      </Link>
      <button
        type="button"
        className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
        disabled={deleting}
        onClick={() => onDeleteOpenChange(true)}
      >
        {deleting ? '删除中…' : '删除策略'}
      </button>
      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
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
                onDeleteOpenChange(false);
                onConfirmDelete();
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailStatusAlerts(props: { detailError: string | null; nodeCatalogError: string | null }) {
  const { detailError, nodeCatalogError } = props;
  return (
    <>
      {detailError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{detailError}</AlertDescription>
        </Alert>
      ) : null}
      {nodeCatalogError ? (
        <Alert variant="destructive">
          <AlertTitle>节点目录加载失败</AlertTitle>
          <AlertDescription>{nodeCatalogError}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

function StrategiesPageContent() {
  const searchParams = useSearchParams();
  const items = useAtomValue(strategiesListAtoms.valueAtom);
  const error = useAtomValue(strategiesListAtoms.errorAtom);
  const refreshList = useSetAtom(strategiesListAtoms.refreshAtom);
  const refreshNodeTypes = useSetAtom(refreshStrategyNodeTypesAtom);
  const { items: nodeCatalog, error: nodeCatalogError } = useAtomValue(strategyNodeTypesAtom);
  const querySelectedId = searchParams.get('strategyId');
  const [selectedIdInput, setSelectedIdInput] = useState<string | null>(querySelectedId);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(nodeCatalog ?? []), [nodeCatalog]);
  const selectedId = useMemo(() => {
    const preferredId = selectedIdInput ?? querySelectedId;
    if (!items || items.length === 0) return null;
    if (preferredId && items.some((item) => item.id === preferredId)) return preferredId;
    return items[0]?.id ?? null;
  }, [items, querySelectedId, selectedIdInput]);

  useEffect(() => {
    void refreshList();
    void refreshNodeTypes();
  }, [refreshList, refreshNodeTypes]);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <SearchList
        className="h-full min-h-0 w-[320px]"
        items={items?.map((s) => ({ ...s, category: '策略' })) ?? null}
        getGroupKey={(item) => item.category}
        renderTitle={(item) => item.name}
        renderDescription={(item) => item.description ?? ''}
        getSearchText={(item) => [item.name, item.description ?? '', item.id].join(' ')}
        title="策略列表"
        searchPlaceholder="搜索策略"
        selectedId={selectedId}
        emptyText={getEmptyText(error, items?.length ?? 0)}
        onItemSelected={(item) => setSelectedIdInput(item.id)}
        toolbarRight={
          <Link href="/strategies/new" className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}>
            <Plus className="size-4" />
          </Link>
        }
      />
      <StrategyDetailPane
        selectedId={selectedId}
        nodeCatalogError={nodeCatalogError}
        nodeTypes={nodeTypes}
        onDeleted={() => {
          setSelectedIdInput(null);
        }}
      />
    </Page>
  );
}

export default function StrategiesPage() {
  return (
    <Suspense
      fallback={
        <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
          <PanelDetailCard title={null}>
            <div className="p-6 text-sm text-muted-foreground">加载中…</div>
          </PanelDetailCard>
        </Page>
      }
    >
      <StrategiesPageContent />
    </Suspense>
  );
}
