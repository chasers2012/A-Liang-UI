import type { EmptyStateProps } from '@/components/empty-state';
import type { DataSyncDatasourceRef, DataSyncTaskPublic } from '@/models/data-sync/dto';

import { readPayloadIdList } from './payload';
import { datasourceDisplayLabel, refsToLabelMap } from './task-form';

export function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function buildDatasourceLabelLookup(
  refs: DataSyncDatasourceRef[] | undefined,
): Record<string, { name: string; type: string }> {
  return refsToLabelMap(refs);
}

export function formatIdList(
  ids: string[],
  labels: Record<string, { name: string; type: string }>,
  refs?: DataSyncDatasourceRef[],
): string {
  return ids
    .map((id) => {
      const fromRef = refs?.find((r) => r.id === id);
      if (fromRef?.name?.trim()) {
        const t = fromRef.type?.trim();
        return t ? `${fromRef.name} (${t})` : fromRef.name;
      }
      return datasourceDisplayLabel(id, [], labels) || id.slice(0, 8);
    })
    .filter(Boolean)
    .join(' + ');
}

export function formatTaskDescription(
  task: DataSyncTaskPublic,
  labels: Record<string, { name: string; type: string }>,
): string {
  const p = (task.payload ?? {}) as Record<string, unknown>;
  const sids = readPayloadIdList(p, 'source_datasource_ids');
  const tids = readPayloadIdList(p, 'target_datasource_ids');
  const sl = formatIdList(sids, labels, task.source_datasource_refs);
  const tl = formatIdList(tids, labels, task.target_datasource_refs);
  const cron = task.cron_expr?.trim() || '仅手动';
  const next = toLocalTime(task.next_run_at);
  return `${sl} → ${tl} · ${cron} · 下次 ${next}`;
}

export function filterTasksBySearch(syncTasks: DataSyncTaskPublic[], listSearchQuery: string): DataSyncTaskPublic[] {
  const q = listSearchQuery.trim().toLowerCase();
  if (!q) return syncTasks;
  return syncTasks.filter((t) => t.name.toLowerCase().includes(q));
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

export function buildListEmptyState(args: {
  error: string | null;
  loading: boolean;
  syncTasksLength: number;
  filteredCount: number;
}): EmptyStateProps {
  const { error, loading, syncTasksLength, filteredCount } = args;
  if (error && !syncTasksLength) {
    return { variant: 'error', title: '加载失败', description: '列表加载失败，请检查网络或重试。' };
  }
  if (loading && !syncTasksLength) {
    return { variant: 'loading', title: '加载中' };
  }
  if (syncTasksLength === 0) {
    return { variant: 'default', title: '暂无同步任务', description: '点击列表上方「新增」创建。' };
  }
  if (filteredCount === 0) {
    return {
      variant: 'default',
      title: '无匹配结果',
      description: '没有符合当前搜索条件的任务。',
    };
  }
  return { variant: 'loading', title: '加载中' };
}
