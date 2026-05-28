import { atom } from 'jotai';

import { getDataSetWorkflowTemplate } from '@/api/data-sets';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

export const dataSetWorkflowTemplateRevisionAtom = atom(0);

export const dataSetWorkflowTemplateAsyncAtom = atom(async (get): Promise<WorkflowGraphPersisted> => {
  get(dataSetWorkflowTemplateRevisionAtom);
  const raw = await getDataSetWorkflowTemplate();
  return parsePersistedWorkflowGraphPayload(raw);
});

export const dataSetWorkflowTemplateAsyncStateAtom = toAsyncValueStateAtom(dataSetWorkflowTemplateAsyncAtom);

export const refreshDataSetWorkflowTemplateAtom = atom(null, (_get, set) => {
  set(dataSetWorkflowTemplateRevisionAtom, (v) => v + 1);
});
