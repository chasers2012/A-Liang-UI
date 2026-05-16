import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { DataSyncDatasourceRef, DataSyncTaskPublic } from '@/models/data-sync/dto';
import type { DataSourcePublic } from '@/models/datasource/dto';

import { readPayloadIdList, readPayloadString } from './payload';

export type DatasourceLabelSnapshot = { name: string; type: string };

export function refsToLabelMap(refs: DataSyncDatasourceRef[] | undefined): Record<string, DatasourceLabelSnapshot> {
  const m: Record<string, DatasourceLabelSnapshot> = {};
  for (const r of refs ?? []) {
    const id = r.id.trim();
    if (!id) continue;
    m[id] = { name: r.name ?? '', type: r.type ?? '' };
  }
  return m;
}

export function isDatasourceDeleted(id: string, live: DataSourcePublic[]): boolean {
  return !live.some((d) => d.id === id);
}

export function datasourceDisplayLabel(
  id: string,
  live: DataSourcePublic[],
  labels: Record<string, DatasourceLabelSnapshot>,
): string {
  const d = live.find((x) => x.id === id);
  if (d) return `${d.name} (${d.type})`;
  const snap = labels[id];
  const n = snap?.name?.trim();
  const t = snap?.type?.trim();
  if (n && t) return `${n} (${t})`;
  if (n) return n;
  return id;
}

export function mergeDatasourceLabelMaps(
  ...maps: Record<string, DatasourceLabelSnapshot>[]
): Record<string, DatasourceLabelSnapshot> {
  return Object.assign({}, ...maps);
}

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
  /** 任务详情快照；目录未包含该 id 时用于展示名称 */
  datasourceLabels: Record<string, DatasourceLabelSnapshot>;
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
    datasourceLabels: {},
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
  const liveIds = new Set(datasources.map((d) => d.id));
  const writableIds = new Set(filterWritableDatasources(datasources).map((d) => d.id));
  if (targetIds.some((id) => liveIds.has(id) && !writableIds.has(id))) {
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
    datasourceLabels: mergeDatasourceLabelMaps(
      refsToLabelMap(task.source_datasource_refs),
      refsToLabelMap(task.target_datasource_refs),
    ),
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
