import { atom } from 'jotai';

import { getEvaluationWorkflowTemplate } from '@/api/evaluation-profiles';
import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

/** 评价方案「新建」默认工作流：在 async atom 内请求并解析；模板固定，由 Jotai 缓存 Promise 结果。 */
export const evaluationWorkflowTemplateAsyncAtom = atom(async (): Promise<WorkflowGraphPersisted> => {
  const raw = await getEvaluationWorkflowTemplate();
  return parsePersistedWorkflowGraphPayload(raw);
});
