import type { DataSourcePublic } from '@/models/datasource/dto';
import type { DataSyncTaskPublic } from '@/models/data-sync/dto';

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

export function formatTaskDescription(task: DataSyncTaskPublic, dsLabelLookup: Map<string, string>): string {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const sids = readPayloadIdList(p, 'source_datasource_ids', 'source_datasource_id');
  const tids = readPayloadIdList(p, 'target_datasource_ids', 'target_datasource_id');
  const sl = formatIdList(sids, dsLabelLookup);
  const tl = formatIdList(tids, dsLabelLookup);
  const cron = task.cron_expr?.trim() || '仅手动';
  const next = toLocalTime(task.next_run_at);
  return `${sl} → ${tl} · ${cron} · 下次 ${next}`;
}

export function filterTasksBySearch(
  syncTasks: DataSyncTaskPublic[],
  listSearchQuery: string,
  describe: (t: DataSyncTaskPublic) => string,
): DataSyncTaskPublic[] {
  const q = listSearchQuery.trim().toLowerCase();
  if (!q) return syncTasks;
  return syncTasks.filter((t) => {
    const hay = `${payloadSearchHaystack(t)} ${describe(t)}`.toLowerCase();
    return hay.includes(q);
  });
}

export function buildSearchListItems(
  filteredTasks: DataSyncTaskPublic[],
  describe: (t: DataSyncTaskPublic) => string,
): Array<{ id: string; label: string; description: string; category: string }> {
  return filteredTasks.map((t) => ({
    id: t.id,
    label: t.name,
    description: describe(t),
    category: '同步任务',
  }));
}

export function buildListNotice(args: {
  error: string | null;
  loading: boolean;
  syncTasksLength: number;
  filteredCount: number;
}): string {
  const { error, loading, syncTasksLength, filteredCount } = args;
  if (error && !syncTasksLength) return '列表加载失败，请检查网络或重试。';
  if (loading && !syncTasksLength) return '加载中…';
  if (syncTasksLength === 0) return '暂无同步任务。点击列表上方「新增」创建。';
  if (filteredCount === 0) return '没有符合当前搜索条件的任务。';
  return '';
}
