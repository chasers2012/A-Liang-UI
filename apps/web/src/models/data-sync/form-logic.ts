import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { validatePreprocessingWorkflow } from '@/models/data-set/form-logic';

import { readPayloadIdList } from './payload';

export function buildSyncPayload(args: {
  sourceIds: string[];
  targetIds: string[];
  initialStartDate: string;
  endDate: string;
  syncWorkflow: WorkflowGraphPersisted;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source_datasource_ids: args.sourceIds,
    target_datasource_ids: args.targetIds,
    source_datasource_id: args.sourceIds[0],
    target_datasource_id: args.targetIds[0],
  };
  const init = args.initialStartDate.trim();
  if (init) out.initial_start_date = init;
  const end = args.endDate.trim();
  if (end) out.end_date = end;
  if (args.syncWorkflow.nodes?.length) {
    out.sync_workflow = args.syncWorkflow;
  }
  return out;
}

export function parseRetryAndTimeout(
  maxRetries: string,
  timeoutSeconds: string,
): { ok: true; maxRetries: number; timeoutSeconds: number } | { ok: false; error: string } {
  const mr = Number.parseInt(maxRetries, 10);
  const to = Number.parseInt(timeoutSeconds, 10);
  if (!Number.isFinite(mr) || mr < 0 || mr > 20) {
    return { ok: false, error: '最大重试次数须为 0–20 的整数。' };
  }
  if (!Number.isFinite(to) || to < 1 || to > 86400) {
    return { ok: false, error: '超时时间须为 1–86400 秒的整数。' };
  }
  return { ok: true, maxRetries: mr, timeoutSeconds: to };
}

export function validateSyncSelections(sourceIds: string[], targetIds: string[]): string | null {
  const sids = sourceIds.map((x) => x.trim()).filter(Boolean);
  const tids = targetIds.map((x) => x.trim()).filter(Boolean);
  if (!sids.length) return '请至少选择一个源数据源。';
  if (!tids.length) return '请至少选择一个目标数据源。';
  if (sids.some((s) => tids.includes(s))) return '源与目标列表不得包含相同的数据源。';
  return null;
}

export function parseSyncFormForSubmit(args: {
  name: string;
  sourceIds: string[];
  targetIds: string[];
  initialStartDate: string;
  endDate: string;
  maxRetries: string;
  timeoutSeconds: string;
  syncWorkflow: WorkflowGraphPersisted;
  getLiveWorkflow: () => WorkflowGraphPersisted | null;
}):
  | { ok: true; name: string; payload: Record<string, unknown>; maxRetries: number; timeoutSeconds: number }
  | { ok: false; error: string } {
  const name = args.name.trim();
  if (!name) return { ok: false, error: '请填写任务名称。' };
  const selErr = validateSyncSelections(args.sourceIds, args.targetIds);
  if (selErr) return { ok: false, error: selErr };

  const live = args.getLiveWorkflow();
  const wf = live ?? args.syncWorkflow;
  const wfErr = validatePreprocessingWorkflow(wf);
  if (wfErr) return { ok: false, error: wfErr };
  const sids = args.sourceIds.map((x) => x.trim()).filter(Boolean);
  if (sids.length > 1 && !wf.nodes?.length) {
    return { ok: false, error: '多源同步须配置完整同步工作流（至少包含一个节点）。' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = buildSyncPayload({
      sourceIds: sids,
      targetIds: args.targetIds.map((x) => x.trim()).filter(Boolean),
      initialStartDate: args.initialStartDate,
      endDate: args.endDate,
      syncWorkflow: wf,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const rt = parseRetryAndTimeout(args.maxRetries, args.timeoutSeconds);
  if (!rt.ok) return rt;
  return { ok: true, name, payload, maxRetries: rt.maxRetries, timeoutSeconds: rt.timeoutSeconds };
}

export function payloadSearchHaystack(task: {
  name: string;
  cron_expr: string | null;
  payload?: Record<string, unknown>;
}): string {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const sids = readPayloadIdList(p, 'source_datasource_ids', 'source_datasource_id');
  const tids = readPayloadIdList(p, 'target_datasource_ids', 'target_datasource_id');
  return [task.name, task.cron_expr ?? '', ...sids, ...tids].join(' ').toLowerCase();
}
