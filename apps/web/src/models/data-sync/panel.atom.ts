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
import type { DataSourcePublic } from '@/models/datasource/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/dto';

import { DATASOURCE_SYNC_TASK_TYPE } from './constants';
import { parseSyncFormForSubmit } from './form-logic';
import {
  buildListNotice,
  buildSearchListItems,
  buildDatasourceLabelLookup,
  filterTasksBySearch,
  formatTaskDescription,
} from './list-helpers';
import { syncWorkflowBoundary } from './sync-workflow-boundary';
import { emptyFormValues, taskToFormValues, type FormValues } from './task-form';

export type DetailTab = 'config' | 'workflow' | 'records';

export const tasksAtom = atom<SchedulerTaskPublic[]>([]);
export const datasourcesAtom = atom<DataSourcePublic[]>([]);
export const loadingAtom = atom(true);
export const errorAtom = atom<string | null>(null);
export const busyIdAtom = atom<string | null>(null);
export const recordsRefreshEpochAtom = atom(0);

export const isEditingAtom = atom(false);
export const selectedIdAtom = atom<string | null>(null);
export const listSearchQueryAtom = atom('');

export const formAtom = atom<FormValues>(emptyFormValues());
export const formErrorAtom = atom<string | null>(null);
export const workflowCanvasKeyAtom = atom(0);
export const workflowCanvasHandleAtom = atom<WorkflowGraphCanvasHandle | null>(null);
export const detailActiveTabAtom = atom<DetailTab>('config');

export const formSourceIdsAtom = atom((get) => get(formAtom).sourceIds);
export const formTargetIdsAtom = atom((get) => get(formAtom).targetIds);

export const applyFormAtom = atom(null, (_get, set, v: FormValues) => {
  set(formAtom, v);
  set(workflowCanvasKeyAtom, (k) => k + 1);
});

export const syncTasksAtom = atom((get) => get(tasksAtom).filter((x) => x.task_type === DATASOURCE_SYNC_TASK_TYPE));

export const datasourceLabelLookupAtom = atom((get) => buildDatasourceLabelLookup(get(datasourcesAtom)));

export const describeTaskAtom = atom((get) => {
  const lookup = get(datasourceLabelLookupAtom);
  return (t: SchedulerTaskPublic) => formatTaskDescription(t, lookup);
});

export const filteredSyncTasksAtom = atom((get) => {
  const syncTasks = get(syncTasksAtom);
  const query = get(listSearchQueryAtom);
  const describe = get(describeTaskAtom);
  return filterTasksBySearch(syncTasks, query, describe);
});

export const searchListItemsAtom = atom((get) => {
  const filtered = get(filteredSyncTasksAtom);
  const describe = get(describeTaskAtom);
  return buildSearchListItems(filtered, describe);
});

export const selectedTaskAtom = atom((get): SchedulerTaskPublic | undefined => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return undefined;
  return get(syncTasksAtom).find((t) => t.id === selectedId);
});

export const listNoticeAtom = atom((get) =>
  buildListNotice({
    error: get(errorAtom),
    loading: get(loadingAtom),
    syncTasksLength: get(syncTasksAtom).length,
    filteredCount: get(filteredSyncTasksAtom).length,
  }),
);

export const recordsTaskIdAtom = atom((get): string | null => get(selectedIdAtom));

export const panelActiveTabAtom = atom((get): DetailTab => {
  const tab = get(detailActiveTabAtom);
  if (get(isEditingAtom) && get(selectedIdAtom) == null && tab === 'records') return 'config';
  return tab;
});

const datasourceNameByIdAtom = atom((get) => Object.fromEntries(get(datasourcesAtom).map((d) => [d.id, d.name])));

export const refreshPageAtom = atom(null, async (_get, set) => {
  set(errorAtom, null);
  set(loadingAtom, true);
  try {
    const [tasks, datasources] = await Promise.all([listSchedulerTasks(), listDatasources()]);
    set(tasksAtom, tasks);
    set(datasourcesAtom, datasources);
    set(recordsRefreshEpochAtom, (n) => n + 1);
  } catch (e) {
    set(errorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(loadingAtom, false);
  }
});

export const listRefreshOnMountEffectAtom = atomEffect((_get, set) => {
  void set(refreshPageAtom);
});

export const autoSelectEffectAtom = atomEffect((get, set) => {
  if (get(isEditingAtom) && get(selectedIdAtom) == null) return;
  const syncTasks = get(syncTasksAtom);
  const selectedId = get(selectedIdAtom);
  if (syncTasks.length === 0) {
    if (selectedId != null) set(selectedIdAtom, null);
    return;
  }
  if (selectedId == null) {
    set(selectedIdAtom, syncTasks[0].id);
    return;
  }
  if (!syncTasks.some((t) => t.id === selectedId)) {
    set(selectedIdAtom, syncTasks[0].id);
  }
});

export const syncViewFormEffectAtom = atomEffect((get, set) => {
  if (get(isEditingAtom)) return;
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  const task = get(syncTasksAtom).find((t) => t.id === selectedId);
  if (task) set(applyFormAtom, taskToFormValues(task));
});

export const workflowBoundaryEffectAtom = atomEffect((get, set) => {
  const sourceIds = get(formSourceIdsAtom);
  const targetIds = get(formTargetIdsAtom);
  const names = get(datasourceNameByIdAtom);
  const handle = get(workflowCanvasHandleAtom);
  const live = handle?.getGraph() ?? null;
  set(formAtom, (prev) => {
    const base = live ?? prev.syncWorkflow;
    const synced = syncWorkflowBoundary(base, sourceIds, targetIds, names);
    return JSON.stringify(synced) === JSON.stringify(prev.syncWorkflow) ? prev : { ...prev, syncWorkflow: synced };
  });
});

export const selectTaskAtom = atom(null, (_get, set, itemId: string) => {
  set(selectedIdAtom, itemId);
  set(isEditingAtom, false);
});

export const startCreateAtom = atom(null, (_get, set) => {
  set(formErrorAtom, null);
  set(applyFormAtom, emptyFormValues());
  set(selectedIdAtom, null);
  set(isEditingAtom, true);
  set(detailActiveTabAtom, 'config');
});

export const enterEditAtom = atom(null, (_get, set) => {
  set(isEditingAtom, true);
});

export const cancelFormAtom = atom(null, (get, set) => {
  set(formErrorAtom, null);
  const isCreating = get(isEditingAtom) && get(selectedIdAtom) == null;
  set(isEditingAtom, false);
  if (isCreating) {
    const syncTasks = get(syncTasksAtom);
    if (syncTasks.length) set(selectedIdAtom, syncTasks[0].id);
    return;
  }
  const selectedId = get(selectedIdAtom);
  const task = selectedId ? get(syncTasksAtom).find((x) => x.id === selectedId) : undefined;
  if (task) set(applyFormAtom, taskToFormValues(task));
});

export const submitFormAtom = atom(null, async (get, set) => {
  set(formErrorAtom, null);
  const form = get(formAtom);
  const isCreating = get(isEditingAtom) && get(selectedIdAtom) == null;
  const selectedId = get(selectedIdAtom);
  const handle = get(workflowCanvasHandleAtom);

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
    set(formErrorAtom, parsed.error);
    return;
  }

  const cron = form.cronExpr.trim() || null;
  set(busyIdAtom, '__save__');
  try {
    if (isCreating) {
      const created = await createSchedulerTask({
        name: parsed.name,
        task_type: DATASOURCE_SYNC_TASK_TYPE,
        cron_expr: cron,
        payload: parsed.payload,
        enabled: form.enabled,
        max_retries: parsed.maxRetries,
        timeout_seconds: parsed.timeoutSeconds,
      });
      set(isEditingAtom, false);
      set(selectedIdAtom, created.id);
      await set(refreshPageAtom);
    } else if (selectedId) {
      const updated = await updateSchedulerTask(selectedId, {
        name: parsed.name,
        cron_expr: cron,
        payload: parsed.payload,
        enabled: form.enabled,
        max_retries: parsed.maxRetries,
        timeout_seconds: parsed.timeoutSeconds,
      });
      set(applyFormAtom, taskToFormValues(updated));
      set(isEditingAtom, false);
      await set(refreshPageAtom);
    }
  } catch (e) {
    set(formErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(busyIdAtom, null);
  }
});

export const triggerTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  set(busyIdAtom, selectedId);
  set(errorAtom, null);
  try {
    await triggerSchedulerTask(selectedId, {});
    await set(refreshPageAtom);
  } catch (e) {
    set(errorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(busyIdAtom, null);
  }
});

export const deleteTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  if (!window.confirm('确定删除该同步任务？游标记录将保留在服务端数据库中，直至你手动清理。')) return;
  set(busyIdAtom, selectedId);
  set(errorAtom, null);
  try {
    await deleteSchedulerTask(selectedId);
    set(selectedIdAtom, null);
    set(isEditingAtom, false);
    await set(refreshPageAtom);
  } catch (e) {
    set(errorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(busyIdAtom, null);
  }
});

export const setDetailTabAtom = atom(null, (get, set, tab: DetailTab) => {
  if (tab === 'records' && get(isEditingAtom) && get(selectedIdAtom) == null) return;
  set(detailActiveTabAtom, tab);
});
