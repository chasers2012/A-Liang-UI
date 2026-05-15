import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { SchedulerTaskPublic } from '@/models/scheduler/dto';

import { readPayloadIdList, readPayloadString } from './payload';

export type DataSyncFormValues = {
  name: string;
  cronExpr: string;
  maxRetries: string;
  timeoutSeconds: string;
  enabled: boolean;
  sourceIds: string[];
  targetIds: string[];
  initialStartDate: string;
  endDate: string;
  syncWorkflow: WorkflowGraphPersisted;
};

export function emptyDataSyncFormValues(): DataSyncFormValues {
  return {
    name: '',
    cronExpr: '',
    maxRetries: '3',
    timeoutSeconds: '300',
    enabled: true,
    sourceIds: [],
    targetIds: [],
    initialStartDate: '',
    endDate: '',
    syncWorkflow: parsePersistedWorkflowGraphPayload({}),
  };
}

export function taskToFormValues(task: SchedulerTaskPublic): DataSyncFormValues {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const wfRaw = p.sync_workflow;
  let syncWorkflow: WorkflowGraphPersisted;
  if (wfRaw && typeof wfRaw === 'object' && !Array.isArray(wfRaw)) {
    syncWorkflow = parsePersistedWorkflowGraphPayload(wfRaw as Record<string, unknown>);
  } else {
    syncWorkflow = parsePersistedWorkflowGraphPayload({});
  }
  return {
    name: task.name,
    cronExpr: task.cron_expr ?? '',
    maxRetries: String(task.max_retries),
    timeoutSeconds: String(task.timeout_seconds),
    enabled: task.enabled,
    sourceIds: readPayloadIdList(p, 'source_datasource_ids', 'source_datasource_id'),
    targetIds: readPayloadIdList(p, 'target_datasource_ids', 'target_datasource_id'),
    initialStartDate: readPayloadString(p, 'initial_start_date'),
    endDate: readPayloadString(p, 'end_date'),
    syncWorkflow,
  };
}

export type DataSyncFormCommitters = {
  setName: (v: string) => void;
  setCronExpr: (v: string) => void;
  setMaxRetries: (v: string) => void;
  setTimeoutSeconds: (v: string) => void;
  setEnabled: (v: boolean) => void;
  setSourceIds: (v: string[]) => void;
  setTargetIds: (v: string[]) => void;
  setInitialStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setSyncWorkflow: (v: WorkflowGraphPersisted) => void;
  bumpSyncWorkflowCanvasKey: () => void;
};

/** 将表单快照写入 React state（新建/选中任务同步/取消编辑）。 */
export function commitDataSyncFormValues(v: DataSyncFormValues, c: DataSyncFormCommitters): void {
  c.setName(v.name);
  c.setCronExpr(v.cronExpr);
  c.setMaxRetries(v.maxRetries);
  c.setTimeoutSeconds(v.timeoutSeconds);
  c.setEnabled(v.enabled);
  c.setSourceIds(v.sourceIds);
  c.setTargetIds(v.targetIds);
  c.setInitialStartDate(v.initialStartDate);
  c.setEndDate(v.endDate);
  c.setSyncWorkflow(v.syncWorkflow);
  c.bumpSyncWorkflowCanvasKey();
}
