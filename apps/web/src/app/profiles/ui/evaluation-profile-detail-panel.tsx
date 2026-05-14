'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { detailAtomFamily, loadDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import { errorAtom, isEditingAtom, loadingAtom, selectedIdAtom } from '@/models/evaluation-profile/scope.atom';
import {
  editorGetLiveWorkflowAtom,
  SUBMIT_ERROR_PREFIX,
  initFormAtom,
  formNameAtom,
} from '@/models/evaluation-profile/form.atom';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';

import { EvaluationProfileMetaTabContent } from './evaluation-profile-meta-tab-content';
import { EvaluationProfilePanelActions } from './evaluation-profile-panel-actions';
import { EvaluationProfileWorkflowTabContent } from './evaluation-profile-workflow-tab-content';

function EvaluationProfileDetailPanelAlerts() {
  const panelError = useAtomValue(errorAtom);
  const panelLoading = useAtomValue(loadingAtom);
  const isEditing = useAtomValue(isEditingAtom);
  const selectedId = useAtomValue(selectedIdAtom);

  if (panelLoading) {
    return <p className="mb-4 text-sm text-muted-foreground">加载中…</p>;
  }

  if (!isEditing && !selectedId) {
    return (
      <Alert className="mb-4">
        <AlertDescription>请选择左侧评价方案。</AlertDescription>
      </Alert>
    );
  }

  if (panelError) {
    const isSubmitError = panelError.startsWith(SUBMIT_ERROR_PREFIX);
    return (
      <Alert variant="destructive" className="mb-4">
        {isSubmitError ? <AlertTitle>无法保存</AlertTitle> : null}
        <AlertDescription>{isSubmitError ? panelError.slice(SUBMIT_ERROR_PREFIX.length) : panelError}</AlertDescription>
      </Alert>
    );
  }

  return null;
}

function getReadonlyTitlePlaceholder(args: {
  selectedId: string | null;
  panelError: string | null;
  panelLoading: boolean;
  row: EvaluationProfilePublic | null;
}) {
  const { selectedId, panelError, panelLoading, row } = args;
  if (!selectedId) return '评价方案';
  if (panelError) return '评价方案详情';
  if (!row && panelLoading) return '加载中…';
  return '评价方案详情';
}

export function EvaluationProfileDetailPanel() {
  const isEditing = useAtomValue(isEditingAtom);
  const [selectedId] = useAtom(selectedIdAtom);

  const isCreate = selectedId == null;
  const formName = useAtomValue(formNameAtom);
  const initForm = useSetAtom(initFormAtom);
  const setName = useSetAtom(formNameAtom);
  const setGetLiveWorkflow = useSetAtom(editorGetLiveWorkflowAtom);

  const row = useAtomValue(detailAtomFamily(selectedId ?? ''));
  const panelError = useAtomValue(errorAtom);
  const panelLoading = useAtomValue(loadingAtom);
  const loadDetail = useSetAtom(loadDetailAtomFamily(selectedId ?? ''));

  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

  useEffect(() => {
    if (!isEditing && selectedId) void loadDetail();
  }, [isEditing, selectedId, loadDetail]);

  useEffect(() => {
    if (!isEditing) return;
    // 编辑态表单由详情缓存填充，不重复请求；若详情尚未写入则等 `loadDetail` 完成后再初始化。
    if (!isCreate && row == null) return;
    void initForm(isCreate ? null : selectedId).then(() => setCanvasKey((k) => k + 1));
  }, [isEditing, isCreate, selectedId, initForm, row]);

  const pending = isEditing && panelLoading;

  useEffect(() => {
    if (!isEditing || pending) {
      setGetLiveWorkflow(null);
      return;
    }
    setGetLiveWorkflow(() => () => canvasRef.current?.getGraph() ?? null);
    return () => setGetLiveWorkflow(null);
  }, [isEditing, pending, setGetLiveWorkflow]);

  const pageTitleValue = isEditing ? (pending ? '' : formName) : (row?.name ?? '');

  return (
    <PanelDetailCard
      title={
        <EditablePageTitle
          value={pageTitleValue}
          showEdit={isEditing}
          onChange={(v) => {
            if (!isEditing) return;
            void setName(v);
          }}
          inputAriaLabel="评价方案名称"
          editButtonAriaLabel="编辑名称"
          placeholder={
            isEditing
              ? isCreate
                ? '新增评价方案'
                : '编辑评价方案'
              : getReadonlyTitlePlaceholder({ selectedId, panelError, panelLoading, row })
          }
        />
      }
      actions={<EvaluationProfilePanelActions />}
      panels={[
        {
          value: 'meta',
          label: '基础信息',
          content: <EvaluationProfileMetaTabContent />,
          contentClassName: 'overflow-y-auto',
        },
        {
          value: 'workflow',
          label: '工作流',
          content: <EvaluationProfileWorkflowTabContent canvasKey={canvasKey} canvasRef={canvasRef} />,
        },
      ]}
    >
      <EvaluationProfileDetailPanelAlerts />
    </PanelDetailCard>
  );
}
