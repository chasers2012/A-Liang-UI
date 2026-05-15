import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

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

export function payloadSearchHaystack(task: {
  name: string;
  cron_expr: string | null;
  payload?: Record<string, unknown>;
}): string {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const sids = readPayloadIdList(p, 'source_datasource_ids');
  const tids = readPayloadIdList(p, 'target_datasource_ids');
  return [task.name, task.cron_expr ?? '', ...sids, ...tids].join(' ').toLowerCase();
}
