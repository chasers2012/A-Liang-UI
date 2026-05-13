'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { WorkflowGraphCanvas, toWorkflowNodeTypes, type WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import { EditablePageDescription } from '@/components/editable-page-description';
import { EditablePageTitle } from '@/components/editable-page-title';
import { PanelDetailCard } from '@/components/panel-detail-card';
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
import { Button } from '@/components/ui/button';
import {
  cancelStrategyEditorAtom,
  enterStrategyEditorAtom,
  strategiesPanelEditTabAtom,
  strategiesPanelIsEditingAtom,
  strategiesPanelSelectedIdAtom,
  strategiesPanelViewTabAtom,
  type StrategiesPanelEditTab,
  type StrategiesPanelViewTab,
} from '@/models/strategy/panel.atom';
import {
  deleteStrategyAtomFamily,
  loadStrategyDetailAtomFamily,
  strategiesListAtoms,
  strategyDetailAtomFamily,
} from '@/models/strategy/list-detail.atom';
import {
  initStrategyFormAtomFamily,
  setStrategyFormDescriptionAtomFamily,
  setStrategyFormNameAtomFamily,
  strategyFormStateAtomFamily,
  submitStrategyFormAtomFamily,
} from '@/models/strategy/form.atom';

import { StrategyWorkflowEditorBlock } from './strategy-editor-main-section';

function buildStrategyViewPanels(args: {
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
      value: 'description' satisfies StrategiesPanelViewTab,
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
      value: 'workflow' satisfies StrategiesPanelViewTab,
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

function ViewDetailActions(props: {
  selectedId: string | null;
  deleting: boolean;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onEdit: () => void;
}) {
  const { selectedId, deleting, deleteOpen, onDeleteOpenChange, onConfirmDelete, onEdit } = props;
  if (!selectedId) return null;
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void onEdit()}>
        编辑
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={deleting}
        onClick={() => onDeleteOpenChange(true)}
      >
        {deleting ? '删除中…' : '删除'}
      </Button>
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

function StrategyDetailPanelEditor() {
  const [selectedId, setPanelSelectedId] = useAtom(strategiesPanelSelectedIdAtom);
  const [editTab, setEditTab] = useAtom(strategiesPanelEditTabAtom);

  const isCreate = selectedId == null;
  const formKey = isCreate ? '__new__' : selectedId;

  const formState = useAtomValue(strategyFormStateAtomFamily(formKey));
  const initForm = useSetAtom(initStrategyFormAtomFamily(formKey));
  const setName = useSetAtom(setStrategyFormNameAtomFamily(formKey));
  const setDescription = useSetAtom(setStrategyFormDescriptionAtomFamily(formKey));
  const submitForm = useSetAtom(submitStrategyFormAtomFamily(formKey));
  const cancelEditor = useSetAtom(cancelStrategyEditorAtom);
  const refreshList = useSetAtom(strategiesListAtoms.refreshAtom);

  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

  useEffect(() => {
    void initForm(isCreate ? null : selectedId).then(() => setCanvasKey((k) => k + 1));
  }, [isCreate, selectedId, initForm]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const wf = canvasRef.current?.getGraph() ?? formState.workflow;
    const savedId = await submitForm({ id: isCreate ? null : selectedId, workflow: wf });
    if (!savedId) return;
    cancelEditor();
    setPanelSelectedId(savedId);
    await refreshList();
  };

  const formId = 'strategy-panel-edit-form';

  if (formState.loadError) {
    return (
      <PanelDetailCard title="编辑策略">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{formState.loadError}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => void cancelEditor()}>
            返回
          </Button>
        </div>
      </PanelDetailCard>
    );
  }

  if (formState.loading || formState.templateLoading) {
    return (
      <PanelDetailCard title={isCreate ? '新增策略' : '编辑策略'}>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </PanelDetailCard>
    );
  }

  const editPanels = [
    {
      value: 'meta' satisfies StrategiesPanelEditTab,
      label: '基础信息',
      content: (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {formState.formError ? (
            <Alert variant="destructive">
              <AlertTitle>无法保存</AlertTitle>
              <AlertDescription>{formState.formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">描述</p>
            <EditablePageDescription
              value={formState.description}
              onChange={(v) => void setDescription(v)}
              textareaAriaLabel="策略描述"
            />
          </div>
        </div>
      ),
      contentClassName: 'overflow-y-auto',
    },
    {
      value: 'workflow' satisfies StrategiesPanelEditTab,
      label: '工作流',
      content: (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {formState.formError ? (
            <Alert variant="destructive" className="shrink-0">
              <AlertTitle>无法保存</AlertTitle>
              <AlertDescription>{formState.formError}</AlertDescription>
            </Alert>
          ) : null}
          <StrategyWorkflowEditorBlock
            workflow={formState.workflow}
            canvasKey={canvasKey}
            canvasRef={canvasRef}
            className="min-h-[320px]"
          />
        </div>
      ),
      contentClassName: 'overflow-hidden',
    },
  ] as const;

  return (
    <PanelDetailCard
      panelActiveTab={editTab}
      onPanelActiveTabChange={(v) => {
        if (v === 'meta' || v === 'workflow') setEditTab(v);
      }}
      title={
        <EditablePageTitle
          value={formState.name}
          showEdit
          onChange={(n) => void setName(n)}
          inputAriaLabel="策略名称"
          editButtonAriaLabel="编辑名称"
          placeholder={isCreate ? '新增策略' : '编辑策略'}
        />
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void cancelEditor()}
            disabled={formState.submitting}
          >
            取消
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={formState.submitting}>
            {formState.submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      }
      panels={editPanels}
    >
      <form id={formId} className="hidden" aria-hidden onSubmit={(ev) => void onSubmit(ev)} />
    </PanelDetailCard>
  );
}

function StrategyDetailPanelView(props: {
  nodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
  nodeCatalogError: string | null;
}) {
  const { nodeTypes, nodeCatalogError } = props;

  const [selectedId, setPanelSelectedId] = useAtom(strategiesPanelSelectedIdAtom);
  const [viewTab, setViewTab] = useAtom(strategiesPanelViewTabAtom);

  const { row, error } = useAtomValue(strategyDetailAtomFamily(selectedId ?? ''));
  const loadDetail = useSetAtom(loadStrategyDetailAtomFamily(selectedId ?? ''));
  const deleteStrategy = useSetAtom(deleteStrategyAtomFamily(selectedId ?? ''));
  const enterEditor = useSetAtom(enterStrategyEditorAtom);

  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail();
  }, [selectedId, loadDetail]);

  const viewTitle = row?.name ?? '策略详情';
  const viewDescription = row?.description || '无描述';
  const showViewEmpty = !selectedId || (!row && !error);
  const detailRow = row;

  const handleDelete = () => {
    if (!selectedId || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    void deleteStrategy()
      .then(() => {
        setPanelSelectedId(null);
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
      panelActiveTab={viewTab}
      onPanelActiveTabChange={(v) => {
        if (v === 'description' || v === 'workflow') setViewTab(v);
      }}
      title={viewTitle}
      actions={
        <ViewDetailActions
          selectedId={selectedId}
          deleting={deleting}
          deleteOpen={deleteOpen}
          onDeleteOpenChange={setDeleteOpen}
          onConfirmDelete={handleDelete}
          onEdit={() => void enterEditor()}
        />
      }
      panels={buildStrategyViewPanels({
        error,
        nodeCatalogError,
        deleteError,
        showEmpty: showViewEmpty,
        description: viewDescription,
        detailRow,
        nodeTypes,
      })}
    />
  );
}

export function StrategyDetailPanel(props: {
  nodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
  nodeCatalogError: string | null;
}) {
  const isEditing = useAtomValue(strategiesPanelIsEditingAtom);
  if (isEditing) return <StrategyDetailPanelEditor />;
  return <StrategyDetailPanelView {...props} />;
}
