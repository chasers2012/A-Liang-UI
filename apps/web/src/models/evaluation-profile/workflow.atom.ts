import { atom } from 'jotai';

import { evaluationProfileFormStateAtomFamily } from '@/models/evaluation-profile/form.atom';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

/**
 * 远程数据层：详情 row 上的工作流图（无 row 或未选中时为 null）。
 */
export const evaluationProfileWorkflowRemoteWorkflowAtom = atom((get) => {
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  if (selectedId == null) return null;
  return get(evaluationProfileDetailAtomFamily(selectedId)).row?.workflow ?? null;
});

/**
 * 本地修改层：表单草稿中的工作流（与 {@link evaluationProfileFormStateAtomFamily} 一致）。
 */
export const evaluationProfileWorkflowLocalWorkflowAtom = atom((get) => {
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  return get(evaluationProfileFormStateAtomFamily(selectedId)).workflow;
});

export type EvaluationProfileWorkflowPresentation = {
  /** 画布 initialGraph：编辑态用本地，只读态用远程，无远程时回落本地（与原 UI 一致） */
  workflow: WorkflowGraphPersisted;
  showCanvas: boolean;
  readOnly: boolean;
};

/** 对 UI 暴露的合并只读状态（远程 + 本地） */
export const evaluationProfileWorkflowPresentationAtom = atom<EvaluationProfileWorkflowPresentation>((get) => {
  const isEditing = get(evaluationProfilesPanelIsEditingAtom);
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  const local = get(evaluationProfileWorkflowLocalWorkflowAtom);
  const remote = get(evaluationProfileWorkflowRemoteWorkflowAtom);
  const { row } = get(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  return {
    workflow: isEditing ? local : (remote ?? local),
    showCanvas: isEditing || (!!selectedId && !!row),
    readOnly: !isEditing,
  };
});
