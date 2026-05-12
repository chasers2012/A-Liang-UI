'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import type { DataSetPublic } from '@/models/data-set/dto';
import { dataSetsIsEditingAtom } from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';
import { dataSetDetailAsyncStateAtomFamily } from '@/models/data-set/detail.atom';
import {
  dataSetEditorHydrateTickAtom,
  dataSetEditorStateAtom,
  initDataSetEditorAtom,
  syncDataSetEditorSystemWorkflowAtom,
} from '@/models/data-set/editor/form-state.atom';
import { dataSetEditorDatasourcesAsyncStateAtom } from '@/models/data-set/editor/datasources.atom';
import { dataSetWorkflowTemplateAsyncStateAtom } from '@/models/data-set/editor/workflow-template.atom';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import { DataSetDetailTabContent } from './data-set-detail-tab-content';
import { DataSetPanelPreviewTabContent } from './data-set-panel-preview-dialog';
import { DataSetPreprocessingTabContent } from './data-set-preprocessing-tab-content';
import { DataSetPanelDialogs, DataSetPanelHeaderActions } from './data-set-panel-actions';

function getReadonlyTitlePlaceholder({
  idForForm,
  loading,
  error,
  row,
}: {
  idForForm: string;
  loading: boolean;
  error: string | null;
  row: DataSetPublic | null;
}) {
  if (!idForForm) return '数据集';
  if (loading) return '加载中…';
  if (error || !row) return '数据集';
  return '数据集详情';
}

/**
 * 右侧主区：统一只渲染一个 {@link PanelDetailCard}。
 * - `detail`: 只读详情
 * - `create` / `edit`: 表单编辑（不再额外渲染 `PanelDetailCard`）
 */
export function DataSetDetailPanel() {
  const dataSetId = (useAtomValue(dataSetsSelectedIdAtom) ?? '').trim();

  // --- detail (readonly) state (async/loadable)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const detailState = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null));
  const readonlyCanvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);

  const detailRow = detailState.value ?? null;
  const detailLoading = detailState.loading;
  const detailError = detailState.error;

  // --- shared datasources/template state (models)
  const datasourcesState = useAtomValue(dataSetEditorDatasourcesAsyncStateAtom);
  const workflowTemplateState = useAtomValue(dataSetWorkflowTemplateAsyncStateAtom);

  const datasourcesValue = useMemo(() => datasourcesState.value ?? [], [datasourcesState.value]);
  const datasources = datasourcesValue;
  const preprocessingWorkflowTemplate = workflowTemplateState.value ?? null;

  // --- editor (create/edit) state (models)
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const initEditor = useSetAtom(initDataSetEditorAtom);
  const syncSystemWorkflow = useSetAtom(syncDataSetEditorSystemWorkflowAtom);
  const editorState = useAtomValue(dataSetEditorStateAtom);
  const hydrateTick = useAtomValue(dataSetEditorHydrateTickAtom);

  const { form } = editorState;
  const canvasKey = hydrateTick;
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    void initEditor({ isEditing, dataSetId });
  }, [isEditing, dataSetId, initEditor]);

  const datasourceNameById = useMemo(() => Object.fromEntries(datasources.map((d) => [d.id, d.name])), [datasources]);

  useEffect(() => {
    if (!isEditing) return;
    const liveGraph = canvasRef.current?.getGraph() ?? null;
    void syncSystemWorkflow({
      liveGraph,
      datasourceNameById,
      template: preprocessingWorkflowTemplate,
    });
  }, [isEditing, form.bindings, datasourceNameById, preprocessingWorkflowTemplate, syncSystemWorkflow]);

  return (
    <>
      <PanelDetailCard
        title={
          <EditablePageTitle
            value={!dataSetId || detailLoading || detailError || !detailRow ? '' : detailRow.name}
            showEdit={isEditing}
            onChange={() => {}}
            placeholder={getReadonlyTitlePlaceholder({
              idForForm: dataSetId,
              loading: detailLoading,
              error: detailError,
              row: detailRow,
            })}
          />
        }
        panels={[
          {
            label: '详情',
            value: 'detail',
            content: (
              <div className="flex min-h-0 flex-1 flex-col overflow-auto space-y-6">
                <DataSetDetailTabContent isEditing={isEditing} />
              </div>
            ),
          },
          {
            label: '预处理',
            value: 'preprocessing',
            content: (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <DataSetPreprocessingTabContent
                  canvasKey={canvasKey}
                  canvasRef={canvasRef}
                  readonlyCanvasRef={readonlyCanvasRef}
                />
              </div>
            ),
          },
          {
            label: '预览',
            value: 'preview',
            content: (
              <div className="flex min-h-80 flex-1 flex-col overflow-hidden">
                <DataSetPanelPreviewTabContent dataSetId={dataSetId} />
              </div>
            ),
          },
        ]}
        actions={<DataSetPanelHeaderActions onOpenDelete={() => setDeleteOpen(true)} />}
      />
      <DataSetPanelDialogs deleteOpen={deleteOpen} onOpenDelete={setDeleteOpen} />
    </>
  );
}
