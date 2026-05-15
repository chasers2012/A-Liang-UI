import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';

import {
  createSchedulerTask,
  deleteSchedulerTask,
  listSchedulerTasks,
  triggerSchedulerTask,
  updateSchedulerTask,
} from '@/api/scheduler';
import { listDatasources } from '@/api/datasources';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { DataSourcePublic } from '@/models/datasource/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/dto';

import { DATASOURCE_SYNC_TASK_TYPE } from './constants';
import { parseSyncFormForSubmit } from './form-logic';
import {
  buildDataSyncListNotice,
  buildDataSyncSearchListItems,
  buildDatasourceLabelLookup,
  filterDataSyncTasksBySearch,
  formatDataSyncTaskDescription,
} from './list-helpers';
import { syncDataSyncWorkflowBoundary } from './sync-workflow-boundary';
import { emptyDataSyncFormValues, taskToFormValues, type DataSyncFormValues } from './task-form';

export type DataSyncDetailTab = 'config' | 'workflow' | 'records';

export const dataSyncTasksAtom = atom<SchedulerTaskPublic[]>([]);
export const dataSyncDatasourcesAtom = atom<DataSourcePublic[]>([]);
export const dataSyncLoadingAtom = atom(true);
export const dataSyncErrorAtom = atom<string | null>(null);
export const dataSyncBusyIdAtom = atom<string | null>(null);
export const dataSyncRecordsRefreshEpochAtom = atom(0);

export const dataSyncCreatingAtom = atom(false);
export const dataSyncPanelEditingAtom = atom(false);
export const dataSyncSelectedIdAtom = atom<string | null>(null);
export const dataSyncListSearchQueryAtom = atom('');

export const dataSyncFormAtom = atom<DataSyncFormValues>(emptyDataSyncFormValues());
export const dataSyncFormErrorAtom = atom<string | null>(null);
export const dataSyncWorkflowCanvasKeyAtom = atom(0);
export const dataSyncWorkflowCanvasHandleAtom = atom<WorkflowGraphCanvasHandle | null>(null);
export const dataSyncDetailActiveTabAtom = atom<DataSyncDetailTab>('config');

export const dataSyncFormSourceIdsAtom = atom((get) => get(dataSyncFormAtom).sourceIds);
export const dataSyncFormTargetIdsAtom = atom((get) => get(dataSyncFormAtom).targetIds);

export const applyDataSyncFormAtom = atom(null, (_get, set, v: DataSyncFormValues) => {
  set(dataSyncFormAtom, v);
  set(dataSyncWorkflowCanvasKeyAtom, (k) => k + 1);
});

export const dataSyncEditActiveAtom = atom((get) => get(dataSyncCreatingAtom) || get(dataSyncPanelEditingAtom));

export const dataSyncShowEditorAtom = atom((get) => get(dataSyncEditActiveAtom));

export const dataSyncSidebarCollapsedAtom = atom((get) => get(dataSyncShowEditorAtom));

export const dataSyncLockedAtom = atom((get) => get(dataSyncBusyIdAtom) != null);

export const dataSyncSyncTasksAtom = atom((get) =>
  get(dataSyncTasksAtom).filter((x) => x.task_type === DATASOURCE_SYNC_TASK_TYPE),
);

export const dataSyncDatasourceLabelLookupAtom = atom((get) =>
  buildDatasourceLabelLookup(get(dataSyncDatasourcesAtom)),
);

export const dataSyncDescribeTaskAtom = atom((get) => {
  const lookup = get(dataSyncDatasourceLabelLookupAtom);
  return (t: SchedulerTaskPublic) => formatDataSyncTaskDescription(t, lookup);
});

export const dataSyncFilteredSyncTasksAtom = atom((get) => {
  const syncTasks = get(dataSyncSyncTasksAtom);
  const query = get(dataSyncListSearchQueryAtom);
  const describe = get(dataSyncDescribeTaskAtom);
  return filterDataSyncTasksBySearch(syncTasks, query, describe);
});

export const dataSyncSearchListItemsAtom = atom((get) => {
  const filtered = get(dataSyncFilteredSyncTasksAtom);
  const describe = get(dataSyncDescribeTaskAtom);
  return buildDataSyncSearchListItems(filtered, describe);
});

export const dataSyncSelectedTaskAtom = atom((get): SchedulerTaskPublic | undefined => {
  const selectedId = get(dataSyncSelectedIdAtom);
  if (!selectedId) return undefined;
  return get(dataSyncSyncTasksAtom).find((t) => t.id === selectedId);
});

export const dataSyncShowDetailFormAtom = atom(
  (get) => get(dataSyncCreatingAtom) || Boolean(get(dataSyncSelectedTaskAtom)),
);

export const dataSyncListNoticeAtom = atom((get) =>
  buildDataSyncListNotice({
    error: get(dataSyncErrorAtom),
    loading: get(dataSyncLoadingAtom),
    syncTasksLength: get(dataSyncSyncTasksAtom).length,
    filteredCount: get(dataSyncFilteredSyncTasksAtom).length,
    datasourcesCount: get(dataSyncDatasourcesAtom).length,
  }),
);

export const dataSyncRecordsTaskIdAtom = atom((get): string | null => {
  if (get(dataSyncCreatingAtom)) return null;
  return get(dataSyncSelectedTaskAtom)?.id ?? null;
});

export const dataSyncPanelActiveTabAtom = atom((get): DataSyncDetailTab => {
  const creating = get(dataSyncCreatingAtom);
  const tab = get(dataSyncDetailActiveTabAtom);
  if (creating && tab === 'records') return 'config';
  return tab;
});

const dataSyncDatasourceNameByIdAtom = atom((get) =>
  Object.fromEntries(get(dataSyncDatasourcesAtom).map((d) => [d.id, d.name])),
);

export const refreshDataSyncPageAtom = atom(null, async (_get, set) => {
  set(dataSyncErrorAtom, null);
  set(dataSyncLoadingAtom, true);
  try {
    const [tasks, datasources] = await Promise.all([listSchedulerTasks(), listDatasources()]);
    set(dataSyncTasksAtom, tasks);
    set(dataSyncDatasourcesAtom, datasources);
    set(dataSyncRecordsRefreshEpochAtom, (n) => n + 1);
  } catch (e) {
    set(dataSyncErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(dataSyncLoadingAtom, false);
  }
});

export const dataSyncListRefreshOnMountEffectAtom = atomEffect((_get, set) => {
  void set(refreshDataSyncPageAtom);
});

export const dataSyncAutoSelectEffectAtom = atomEffect((get, set) => {
  const creating = get(dataSyncCreatingAtom);
  if (creating) return;
  const syncTasks = get(dataSyncSyncTasksAtom);
  const selectedId = get(dataSyncSelectedIdAtom);
  if (syncTasks.length === 0) {
    if (selectedId != null) set(dataSyncSelectedIdAtom, null);
    return;
  }
  if (selectedId == null) {
    set(dataSyncSelectedIdAtom, syncTasks[0].id);
    return;
  }
  if (!syncTasks.some((t) => t.id === selectedId)) {
    set(dataSyncSelectedIdAtom, syncTasks[0].id);
  }
});

export const dataSyncSyncViewFormEffectAtom = atomEffect((get, set) => {
  if (get(dataSyncCreatingAtom)) return;
  if (get(dataSyncPanelEditingAtom)) return;
  const selectedId = get(dataSyncSelectedIdAtom);
  if (!selectedId) return;
  const task = get(dataSyncSyncTasksAtom).find((t) => t.id === selectedId);
  if (task) set(applyDataSyncFormAtom, taskToFormValues(task));
});

export const dataSyncWorkflowBoundaryEffectAtom = atomEffect((get, set) => {
  const sourceIds = get(dataSyncFormSourceIdsAtom);
  const targetIds = get(dataSyncFormTargetIdsAtom);
  const names = get(dataSyncDatasourceNameByIdAtom);
  const handle = get(dataSyncWorkflowCanvasHandleAtom);
  const live = handle?.getGraph() ?? null;
  set(dataSyncFormAtom, (prev) => {
    const base = live ?? prev.syncWorkflow;
    const synced = syncDataSyncWorkflowBoundary(base, sourceIds, targetIds, names);
    return JSON.stringify(synced) === JSON.stringify(prev.syncWorkflow) ? prev : { ...prev, syncWorkflow: synced };
  });
});

export const selectDataSyncTaskAtom = atom(null, (_get, set, itemId: string) => {
  set(dataSyncCreatingAtom, false);
  set(dataSyncPanelEditingAtom, false);
  set(dataSyncSelectedIdAtom, itemId);
});

export const startCreateDataSyncAtom = atom(null, (_get, set) => {
  set(dataSyncFormErrorAtom, null);
  set(applyDataSyncFormAtom, emptyDataSyncFormValues());
  set(dataSyncPanelEditingAtom, false);
  set(dataSyncCreatingAtom, true);
  set(dataSyncSelectedIdAtom, null);
  set(dataSyncDetailActiveTabAtom, 'config');
});

export const enterDataSyncEditAtom = atom(null, (_get, set) => {
  set(dataSyncPanelEditingAtom, true);
});

export const cancelDataSyncFormAtom = atom(null, (get, set) => {
  set(dataSyncFormErrorAtom, null);
  if (get(dataSyncCreatingAtom)) {
    set(dataSyncCreatingAtom, false);
    set(dataSyncPanelEditingAtom, false);
    const syncTasks = get(dataSyncSyncTasksAtom);
    if (syncTasks.length) set(dataSyncSelectedIdAtom, syncTasks[0].id);
    return;
  }
  set(dataSyncPanelEditingAtom, false);
  const selectedId = get(dataSyncSelectedIdAtom);
  const task = selectedId ? get(dataSyncSyncTasksAtom).find((x) => x.id === selectedId) : undefined;
  if (task) set(applyDataSyncFormAtom, taskToFormValues(task));
});

export const submitDataSyncFormAtom = atom(null, async (get, set) => {
  set(dataSyncFormErrorAtom, null);
  const form = get(dataSyncFormAtom);
  const creating = get(dataSyncCreatingAtom);
  const selectedId = get(dataSyncSelectedIdAtom);
  const handle = get(dataSyncWorkflowCanvasHandleAtom);

  const parsed = parseSyncFormForSubmit({
    name: form.name,
    sourceIds: form.sourceIds,
    targetIds: form.targetIds,
    initialStartDate: form.initialStartDate,
    endDate: form.endDate,
    maxRetries: form.maxRetries,
    timeoutSeconds: form.timeoutSeconds,
    syncWorkflow: form.syncWorkflow,
    getLiveWorkflow: () => handle?.getGraph() ?? null,
  });
  if (!parsed.ok) {
    set(dataSyncFormErrorAtom, parsed.error);
    return;
  }

  const cron = form.cronExpr.trim() || null;
  set(dataSyncBusyIdAtom, '__save__');
  try {
    if (creating) {
      const created = await createSchedulerTask({
        name: parsed.name,
        task_type: DATASOURCE_SYNC_TASK_TYPE,
        cron_expr: cron,
        payload: parsed.payload,
        enabled: form.enabled,
        max_retries: parsed.maxRetries,
        timeout_seconds: parsed.timeoutSeconds,
      });
      set(dataSyncCreatingAtom, false);
      set(dataSyncPanelEditingAtom, false);
      set(dataSyncSelectedIdAtom, created.id);
      await set(refreshDataSyncPageAtom);
    } else if (selectedId) {
      const updated = await updateSchedulerTask(selectedId, {
        name: parsed.name,
        cron_expr: cron,
        payload: parsed.payload,
        enabled: form.enabled,
        max_retries: parsed.maxRetries,
        timeout_seconds: parsed.timeoutSeconds,
      });
      set(applyDataSyncFormAtom, taskToFormValues(updated));
      set(dataSyncPanelEditingAtom, false);
      await set(refreshDataSyncPageAtom);
    }
  } catch (e) {
    set(dataSyncFormErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(dataSyncBusyIdAtom, null);
  }
});

export const toggleDataSyncEnabledAtom = atom(null, async (get, set) => {
  const task = get(dataSyncSelectedTaskAtom);
  if (!task) return;
  set(dataSyncBusyIdAtom, task.id);
  set(dataSyncErrorAtom, null);
  try {
    await updateSchedulerTask(task.id, { enabled: !task.enabled });
    await set(refreshDataSyncPageAtom);
  } catch (e) {
    set(dataSyncErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(dataSyncBusyIdAtom, null);
  }
});

export const triggerDataSyncTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(dataSyncSelectedIdAtom);
  if (!selectedId) return;
  set(dataSyncBusyIdAtom, selectedId);
  set(dataSyncErrorAtom, null);
  try {
    await triggerSchedulerTask(selectedId, {});
    await set(refreshDataSyncPageAtom);
  } catch (e) {
    set(dataSyncErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(dataSyncBusyIdAtom, null);
  }
});

export const deleteDataSyncTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(dataSyncSelectedIdAtom);
  if (!selectedId) return;
  if (!window.confirm('确定删除该同步任务？游标记录将保留在服务端数据库中，直至你手动清理。')) return;
  set(dataSyncBusyIdAtom, selectedId);
  set(dataSyncErrorAtom, null);
  try {
    await deleteSchedulerTask(selectedId);
    set(dataSyncSelectedIdAtom, null);
    set(dataSyncCreatingAtom, false);
    set(dataSyncPanelEditingAtom, false);
    await set(refreshDataSyncPageAtom);
  } catch (e) {
    set(dataSyncErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(dataSyncBusyIdAtom, null);
  }
});

export const setDataSyncDetailTabAtom = atom(null, (get, set, tab: DataSyncDetailTab) => {
  if (tab === 'records' && get(dataSyncCreatingAtom)) return;
  set(dataSyncDetailActiveTabAtom, tab);
});
