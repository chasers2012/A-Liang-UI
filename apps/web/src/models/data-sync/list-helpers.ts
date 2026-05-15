import type { DataSourcePublic } from '@/models/datasource/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/dto';

import { payloadSearchHaystack } from './form-logic';
import { readPayloadIdList } from './payload';

export function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function buildDatasourceLabelLookup(datasources: DataSourcePublic[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of datasources) {
    m.set(d.id, `${d.name} (${d.type})`);
  }
  return m;
}

export function formatIdList(ids: string[], dsLabelLookup: Map<string, string>): string {
  return ids
    .map((id) => dsLabelLookup.get(id) ?? id.slice(0, 8))
    .filter(Boolean)
    .join(' + ');
}

export function formatDataSyncTaskDescription(task: SchedulerTaskPublic, dsLabelLookup: Map<string, string>): string {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const sids = readPayloadIdList(p, 'source_datasource_ids', 'source_datasource_id');
  const tids = readPayloadIdList(p, 'target_datasource_ids', 'target_datasource_id');
  const sl = formatIdList(sids, dsLabelLookup);
  const tl = formatIdList(tids, dsLabelLookup);
  const cron = task.cron_expr?.trim() || '仅手动';
  const next = toLocalTime(task.next_run_at);
  return `${sl} → ${tl} · ${cron} · 下次 ${next}`;
}

export function filterDataSyncTasksBySearch(
  syncTasks: SchedulerTaskPublic[],
  listSearchQuery: string,
  describe: (t: SchedulerTaskPublic) => string,
): SchedulerTaskPublic[] {
  const q = listSearchQuery.trim().toLowerCase();
  if (!q) return syncTasks;
  return syncTasks.filter((t) => {
    const hay = `${payloadSearchHaystack(t)} ${describe(t)}`.toLowerCase();
    return hay.includes(q);
  });
}

export function buildDataSyncSearchListItems(
  filteredTasks: SchedulerTaskPublic[],
  describe: (t: SchedulerTaskPublic) => string,
): Array<{ id: string; label: string; description: string; category: string }> {
  return filteredTasks.map((t) => ({
    id: t.id,
    label: t.name,
    description: describe(t),
    category: '同步任务',
  }));
}

export function buildDataSyncListNotice(args: {
  error: string | null;
  loading: boolean;
  syncTasksLength: number;
  filteredCount: number;
  datasourcesCount: number;
}): string {
  const { error, loading, syncTasksLength, filteredCount, datasourcesCount } = args;
  if (error && !syncTasksLength) return '列表加载失败，请检查网络或重试。';
  if (loading && !syncTasksLength) return '加载中…';
  if (datasourcesCount < 2) return '请先在「数据源」中至少配置两个数据源。';
  if (syncTasksLength === 0) return '暂无同步任务。点击列表上方「新增」创建。';
  if (filteredCount === 0) return '没有符合当前搜索条件的任务。';
  return '';
}
