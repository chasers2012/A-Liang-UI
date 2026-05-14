import { atom } from 'jotai';

import { formWorkflowAtom } from '@/models/evaluation-profile/form.atom';
import { detailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import { isEditingAtom, selectedIdAtom } from '@/models/evaluation-profile/scope.atom';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

/**
 * 远程数据层：详情 row 上的工作流图（无 row 或未选中时为 null）。
 */
export const remoteWorkflowAtom = atom((get) => {
  const sid = get(selectedIdAtom);
  if (sid == null) return null;
  return get(detailAtomFamily(sid))?.workflow ?? null;
});

/**
 * 本地修改层：表单草稿中的工作流（与 {@link formWorkflowAtom} 一致）。
 */
export const localWorkflowAtom = atom((get) => get(formWorkflowAtom));

export type WorkflowDerived = {
  /** initialGraph 取值：编辑会话用表单草稿，否则用远程；无远程时回落为草稿。 */
  workflow: WorkflowGraphPersisted;
  /** 是否具备可绑定工作流图的数据上下文（编辑中或已加载到 row）。 */
  workflowGraphAvailable: boolean;
  /** 工作流图是否禁止编辑（与编辑会话互斥）。 */
  workflowReadOnly: boolean;
};

/** 合并远程与表单的只读派生状态。 */
export const workflowDerivedAtom = atom<WorkflowDerived>((get) => {
  const editing = get(isEditingAtom);
  const sid = get(selectedIdAtom);
  const local = get(localWorkflowAtom);
  const remote = get(remoteWorkflowAtom);
  const row = get(detailAtomFamily(sid ?? ''));
  return {
    workflow: editing ? local : (remote ?? local),
    workflowGraphAvailable: editing || (!!sid && !!row),
    workflowReadOnly: !editing,
  };
});
