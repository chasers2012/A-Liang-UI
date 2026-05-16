import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { DataSyncTaskPublic } from '@/models/data-sync/dto';
import type { DataSourcePublic } from '@/models/datasource/dto';

import { readPayloadIdList, readPayloadString } from './payload';

export function filterWritableDatasources(datasources: DataSourcePublic[]): DataSourcePublic[] {
  return datasources.filter((d) => d.write_enabled);
}

export function targetDatasourceOptions(
  all: DataSourcePublic[],
  selectedTargetIds: string[],
  readOnly: boolean,
): DataSourcePublic[] {
  if (readOnly) return all;
  const writable = filterWritableDatasources(all);
  const extras = all.filter((d) => selectedTargetIds.includes(d.id) && !d.write_enabled);
  if (extras.length === 0) return writable;
  const seen = new Set(writable.map((d) => d.id));
  return [...writable, ...extras.filter((d) => !seen.has(d.id))];
}

export type FormValues = {
  name: string;
  cronExpr: string;
  maxRetries: string;
  timeoutSeconds: string;
  enabled: boolean;
  sourceIds: string[];
  targetIds: string[];
  startDate: string;
  endDate: string;
  syncWorkflow: WorkflowGraphPersisted;
};

export function emptyFormValues(): FormValues {
  return {
    name: '',
    cronExpr: '0 20 * * 1-5',
    maxRetries: '3',
    timeoutSeconds: '300',
    enabled: true,
    sourceIds: [],
    targetIds: [],
    startDate: '',
    endDate: '',
    syncWorkflow: parsePersistedWorkflowGraphPayload({}),
  };
}

export function validateDataSyncForm(form: FormValues, datasources: DataSourcePublic[]): string | null {
  const sourceIds = form.sourceIds.map((x) => x.trim()).filter(Boolean);
  if (sourceIds.length === 0) {
    return '请至少选择一个源数据源。';
  }
  const targetIds = form.targetIds.map((x) => x.trim()).filter(Boolean);
  if (targetIds.length === 0) {
    return '请至少选择一个目标数据源。';
  }
  const writableIds = new Set(filterWritableDatasources(datasources).map((d) => d.id));
  if (targetIds.some((id) => !writableIds.has(id))) {
    return '目标数据源须为已开启写入的数据源。';
  }
  if (sourceIds.some((id) => targetIds.includes(id))) {
    return '源数据源与目标数据源不得重复。';
  }
  if (!form.startDate.trim()) {
    return '请配置起始日期。';
  }
  return null;
}

export function taskToFormValues(task: DataSyncTaskPublic): FormValues {
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
    sourceIds: readPayloadIdList(p, 'source_datasource_ids'),
    targetIds: readPayloadIdList(p, 'target_datasource_ids'),
    startDate: readPayloadString(p, 'start_date') || readPayloadString(p, 'initial_start_date'),
    endDate: readPayloadString(p, 'end_date'),
    syncWorkflow,
  };
}

export type FormCommitters = {
  setName: (v: string) => void;
  setCronExpr: (v: string) => void;
  setMaxRetries: (v: string) => void;
  setTimeoutSeconds: (v: string) => void;
  setEnabled: (v: boolean) => void;
  setSourceIds: (v: string[]) => void;
  setTargetIds: (v: string[]) => void;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setSyncWorkflow: (v: WorkflowGraphPersisted) => void;
  bumpSyncWorkflowCanvasKey: () => void;
};

/** 将表单快照写入 React state（新建/选中任务同步/取消编辑）。 */
export function commitFormValues(v: FormValues, c: FormCommitters): void {
  c.setName(v.name);
  c.setCronExpr(v.cronExpr);
  c.setMaxRetries(v.maxRetries);
  c.setTimeoutSeconds(v.timeoutSeconds);
  c.setEnabled(v.enabled);
  c.setSourceIds(v.sourceIds);
  c.setTargetIds(v.targetIds);
  c.setStartDate(v.startDate);
  c.setEndDate(v.endDate);
  c.setSyncWorkflow(v.syncWorkflow);
  c.bumpSyncWorkflowCanvasKey();
}
