'use client';

import { useAtomValue } from 'jotai';
import type { RefObject } from 'react';

import { ProfileWorkflowEditorBlock } from './profile-editor-main-section';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelLoadingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';
import { evaluationProfileFormStateAtomFamily } from '@/models/evaluation-profile/form.atom';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';

export function EvaluationProfileWorkflowTabContent(props: {
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
}) {
  const { canvasKey, canvasRef } = props;
  const isEditing = useAtomValue(evaluationProfilesPanelIsEditingAtom);
  const selectedId = useAtomValue(evaluationProfilesPanelSelectedIdAtom);
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(selectedId));
  const { row } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  const panelLoading = useAtomValue(evaluationProfilesPanelLoadingAtom);

  if (panelLoading) return null;

  const showCanvas = isEditing || (!!selectedId && !!row);
  const workflowForCanvas = isEditing ? formState.workflow : (row?.workflow ?? formState.workflow);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
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
