'use client';

import type { RefObject } from 'react';
import { useAtomValue } from 'jotai';

import { EmptyState, PanelPlaceholder } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { dataSetsIsEditingAtom } from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';
import { dataSetDetailAsyncStateAtomFamily } from '@/models/data-set/detail.atom';
import { dataSetEditorStateAtom } from '@/models/data-set/editor/form-state.atom';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';

import { PreprocessingWorkflowEditorBlock } from './preprocessing-workflow-editor-block';

// eslint-disable-next-line complexity
export function DataSetPreprocessingTabContent(props: {
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  readonlyCanvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
}) {
  const { canvasKey, canvasRef, readonlyCanvasRef } = props;
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const dataSetId = (useAtomValue(dataSetsSelectedIdAtom) ?? '').trim();
  const idForForm = dataSetId;

  const detailState = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null));
  const row = detailState.value ?? null;
  const loading = detailState.loading;
  const error = detailState.error;

  const { editorLoading, editorLoadError, formError, form } = useAtomValue(dataSetEditorStateAtom);

  if (!isEditing && !idForForm) {
    return <PanelPlaceholder title="请选择数据集" description="从左侧选择一个数据集后可查看预处理工作流。" />;
  }

  if (!isEditing && loading) {
    return <EmptyState variant="loading" title="加载中" description="加载完成后可在此查看预处理工作流。" compact />;
  }

  if (isEditing && editorLoading) {
    return <EmptyState variant="loading" title="加载中" compact />;
  }

  if (!isEditing && (error || !row)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无法加载数据集</AlertTitle>
        <AlertDescription>{error ?? '未知错误'}</AlertDescription>
      </Alert>
    );
  }

  if (isEditing && editorLoadError && Boolean(idForForm)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无法加载数据集</AlertTitle>
        <AlertDescription>{editorLoadError}</AlertDescription>
      </Alert>
    );
  }

  const workflow = isEditing ? form.preprocessing_workflow : row!.preprocessing_workflow;
  const resolvedCanvasKey = isEditing ? canvasKey : 0;
  const resolvedCanvasRef = isEditing ? canvasRef : readonlyCanvasRef;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {isEditing && formError ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>提交失败</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <PreprocessingWorkflowEditorBlock
        readOnly={!isEditing}
        className="min-h-0 flex-1"
        workflow={workflow}
        canvasKey={resolvedCanvasKey}
        canvasRef={resolvedCanvasRef}
      />
    </div>
  );
}
