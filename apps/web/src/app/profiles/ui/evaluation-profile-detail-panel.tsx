'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import {
  evaluationProfileDetailAtomFamily,
  loadEvaluationProfileDetailAtomFamily,
} from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';
import {
  evaluationProfileEditorGetLiveWorkflowAtom,
  initEvaluationProfileFormAtomFamily,
  setEvaluationProfileFormNameAtomFamily,
  evaluationProfileFormStateAtomFamily,
} from '@/models/evaluation-profile/form.atom';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';

import { EvaluationProfileMetaTabContent } from './evaluation-profile-meta-tab-content';
import { EvaluationProfilePanelActions } from './evaluation-profile-panel-actions';
import { EvaluationProfileWorkflowTabContent } from './evaluation-profile-workflow-tab-content';

function getReadonlyTitlePlaceholder(args: {
  selectedId: string | null;
  error: string | null;
  row: EvaluationProfilePublic | null;
}) {
  const { selectedId, error, row } = args;
  if (!selectedId) return '评价方案';
  if (!row && !error) return '加载中…';
  if (error) return '评价方案详情';
  return '评价方案详情';
}

export function EvaluationProfileDetailPanel() {
  const isEditing = useAtomValue(evaluationProfilesPanelIsEditingAtom);
  const [selectedId] = useAtom(evaluationProfilesPanelSelectedIdAtom);

  const isCreate = selectedId == null;
  const formKey = isCreate ? '__new__' : selectedId;
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(formKey));
  const initForm = useSetAtom(initEvaluationProfileFormAtomFamily(formKey));
  const setName = useSetAtom(setEvaluationProfileFormNameAtomFamily(formKey));
  const setGetLiveWorkflow = useSetAtom(evaluationProfileEditorGetLiveWorkflowAtom);

  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  const loadDetail = useSetAtom(loadEvaluationProfileDetailAtomFamily(selectedId ?? ''));

  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

  useEffect(() => {
    if (!isEditing && selectedId) void loadDetail();
  }, [isEditing, selectedId, loadDetail]);

  useEffect(() => {
    if (!isEditing) return;
    void initForm(isCreate ? null : selectedId).then(() => setCanvasKey((k) => k + 1));
  }, [isEditing, isCreate, selectedId, initForm]);

  const pending = isEditing && (formState.loading || formState.templateLoading || formState.loadError);

  useEffect(() => {
    if (!isEditing || pending) {
      setGetLiveWorkflow(null);
      return;
    }
    setGetLiveWorkflow(() => () => canvasRef.current?.getGraph() ?? null);
    return () => setGetLiveWorkflow(null);
  }, [isEditing, pending, setGetLiveWorkflow]);

  const pageTitleValue = isEditing ? (pending ? '' : formState.name) : (row?.name ?? '');

  return (
    <>
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
                : getReadonlyTitlePlaceholder({ selectedId, error, row })
            }
          />
        }
        actions={<EvaluationProfilePanelActions />}
        panels={[
          {
            value: 'meta',
            label: '基础信息',
            content: (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <EvaluationProfileMetaTabContent isEditing={isEditing} />
              </div>
            ),
            contentClassName: 'overflow-y-auto',
          },
          {
            value: 'workflow',
            label: '工作流',
            content: (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <EvaluationProfileWorkflowTabContent
                  isEditing={isEditing}
                  canvasKey={canvasKey}
                  canvasRef={canvasRef}
                />
              </div>
            ),
            contentClassName: 'overflow-hidden',
          },
        ]}
      />
    </>
  );
}
