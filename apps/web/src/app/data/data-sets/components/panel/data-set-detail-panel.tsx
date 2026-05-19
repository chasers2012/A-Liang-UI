'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import type { DataSetPublic } from '@/models/data-set/dto';
import { dataSetsIsEditingAtom, dataSetDetailPanelActiveTabAtom } from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';
import { dataSetDetailAsyncStateAtomFamily } from '@/models/data-set/detail.atom';
import { prepareDataSetEditorAtom } from '@/models/data-set/edit.atom';
import {
  dataSetEditorHydrateTickAtom,
  dataSetEditorStateAtom,
  setDataSetEditorFormPatchAtom,
  syncDataSetEditorSystemWorkflowAtom,
} from '@/models/data-set/editor/form-state.atom';
import { datasourcesListAtoms } from '@/models/datasource/panel.atom';
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
  const [panelActiveTab, setPanelActiveTab] = useAtom(dataSetDetailPanelActiveTabAtom);
  const detailState = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null));
  const readonlyCanvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);

  const detailRow = detailState.value ?? null;
  const detailLoading = detailState.loading;
  const detailError = detailState.error;

  // --- shared datasources/template state (models)
  const datasourcesItems = useAtomValue(datasourcesListAtoms.valueAtom);
  const workflowTemplateState = useAtomValue(dataSetWorkflowTemplateAsyncStateAtom);

  const datasourcesValue = useMemo(() => datasourcesItems ?? [], [datasourcesItems]);
  const datasources = datasourcesValue;
  const preprocessingWorkflowTemplate = workflowTemplateState.value ?? null;

  // --- editor (create/edit) state (models)
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const initEditor = useSetAtom(prepareDataSetEditorAtom);
  const patchForm = useSetAtom(setDataSetEditorFormPatchAtom);
  const syncSystemWorkflow = useSetAtom(syncDataSetEditorSystemWorkflowAtom);
  const editorState = useAtomValue(dataSetEditorStateAtom);
  const hydrateTick = useAtomValue(dataSetEditorHydrateTickAtom);

  const { form } = editorState;
  const canvasKey = hydrateTick;
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);

  const pageTitleValue = isEditing
    ? form.name
    : !dataSetId || detailLoading || detailError || !detailRow
      ? ''
      : detailRow.name;

  useEffect(() => {
    if (!isEditing) return;
    void initEditor({ isEditing, dataSetId });
  }, [isEditing, dataSetId, initEditor]);

  useEffect(() => {
    if (!isEditing || panelActiveTab !== 'preview') return;
    setPanelActiveTab('detail');
  }, [isEditing, panelActiveTab, setPanelActiveTab]);

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
            value={pageTitleValue}
            showEdit={isEditing}
            onChange={(v) => {
              if (!isEditing) return;
              patchForm({ name: v });
            }}
            placeholder={getReadonlyTitlePlaceholder({
              idForForm: dataSetId,
              loading: detailLoading,
              error: detailError,
              row: detailRow,
            })}
          />
        }
        panelActiveTab={panelActiveTab}
        onPanelActiveTabChange={(v) => {
          if (v !== 'detail' && v !== 'preprocessing' && v !== 'preview') return;
          if (isEditing && v === 'preview') return;
          setPanelActiveTab(v);
        }}
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
            disabled: isEditing,
            content: (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <DataSetPanelPreviewTabContent dataSetId={dataSetId} />
              </div>
            ),
          },
        ]}
        actions={
          <DataSetPanelHeaderActions
            onOpenDelete={() => setDeleteOpen(true)}
            panelActiveTab={panelActiveTab}
            onGoToPreprocessing={() => setPanelActiveTab('preprocessing')}
            getLivePreprocessingWorkflow={() => canvasRef.current?.getGraph() ?? null}
          />
        }
      />
      <DataSetPanelDialogs deleteOpen={deleteOpen} onOpenDelete={setDeleteOpen} />
    </>
  );
}
