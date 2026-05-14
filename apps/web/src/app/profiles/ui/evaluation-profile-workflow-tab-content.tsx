'use client';

import { useAtomValue } from 'jotai';
import type { RefObject } from 'react';

import { evaluationProfileDetailGate } from './evaluation-profile-detail-gate';
import { ProfileWorkflowEditorBlock } from './profile-editor-main-section';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import { evaluationProfilesPanelSelectedIdAtom } from '@/models/evaluation-profile/panel.atom';
import { evaluationProfileFormStateAtomFamily } from '@/models/evaluation-profile/form.atom';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';

export function EvaluationProfileWorkflowTabContent(props: {
  isEditing: boolean;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
}) {
  const { isEditing, canvasKey, canvasRef } = props;
  const selectedId = useAtomValue(evaluationProfilesPanelSelectedIdAtom);
  const isCreate = selectedId == null;
  const formKey = isCreate ? '__new__' : selectedId;
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(formKey));
  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));

  const pending = isEditing && (formState.loading || formState.templateLoading || formState.loadError);

  if (pending) {
    return <p className="p-6 text-sm text-muted-foreground">加载工作流编辑器…</p>;
  }

  const gate = !isEditing ? evaluationProfileDetailGate(selectedId, error, row) : null;
  const showCanvas = isEditing || gate == null;
  const workflowForCanvas = isEditing ? formState.workflow : (row?.workflow ?? formState.workflow);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {!isEditing && gate}
      {showCanvas ? (
        <ProfileWorkflowEditorBlock
          readOnly={!isEditing}
          workflow={workflowForCanvas}
          canvasKey={canvasKey}
          canvasRef={canvasRef}
          className="min-h-[320px]"
        />
      ) : null}
    </div>
  );
}
