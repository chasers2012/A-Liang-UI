import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';

import type { RefreshableAsyncRefreshOptions } from '@/lib/refreshable-async-atoms';

import {
  createDataSyncTask,
  deleteDataSyncTask,
  listDataSyncTasks,
  triggerDataSyncTask,
  updateDataSyncTask,
} from '@/api/data-sync';
import { listDatasources } from '@/api/datasources';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { DataSourcePublic } from '@/models/datasource/dto';
import type { DatasourceLabelSnapshot } from '@/models/data-sync/task-form';
import type { DataSyncTaskPublic } from '@/models/data-sync/dto';
import { schedulerActiveJobsAtoms } from '@/models/scheduler/jobs/active.atom';
import { schedulerJobsListAtoms } from '@/models/scheduler/jobs/list.atom';
import {
  buildListEmptyState,
  buildSearchListItems,
  buildDatasourceLabelLookup,
  filterTasksBySearch,
  formatTaskDescription,
} from './list-helpers';
import { syncWorkflowBoundary } from './sync-workflow-boundary';
import {
  emptyFormValues,
  mergeDatasourceLabelMaps,
  taskToFormValues,
  validateDataSyncForm,
  type FormValues,
} from './task-form';

export type DetailTab = 'config' | 'workflow' | 'records';

export const tasksAtom = atom<DataSyncTaskPublic[]>([]);
export const datasourcesAtom = atom<DataSourcePublic[]>([]);
export const loadingAtom = atom(true);
export const errorAtom = atom<string | null>(null);
export const isBusyAtom = atom(false);
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

export const describeTaskAtom = atom((get) => {
  const live = get(datasourcesAtom);
  return (t: DataSyncTaskPublic) => {
    const labels = mergeDatasourceLabelMaps(
      buildDatasourceLabelLookup(t.source_datasource_refs),
      buildDatasourceLabelLookup(t.target_datasource_refs),
    );
    for (const d of live) {
      labels[d.id] = { name: d.name, type: d.type };
    }
    return formatTaskDescription(t, labels);
  };
});

export const filteredSyncTasksAtom = atom((get) => filterTasksBySearch(get(tasksAtom), get(listSearchQueryAtom)));

export const searchListItemsAtom = atom((get) => {
  const filtered = get(filteredSyncTasksAtom);
  const describe = get(describeTaskAtom);
  return buildSearchListItems(filtered, describe);
});

export const selectedTaskAtom = atom((get): DataSyncTaskPublic | undefined => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return undefined;
  return get(tasksAtom).find((t) => t.id === selectedId);
});

export const listEmptyStateAtom = atom((get) =>
  buildListEmptyState({
    error: get(errorAtom),
    loading: get(loadingAtom),
    syncTasksLength: get(tasksAtom).length,
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

export const refreshPageAtom = atom(null, async (_get, set, options?: RefreshableAsyncRefreshOptions) => {
  set(errorAtom, null);
  if (!options?.silent) {
    set(loadingAtom, true);
  }
  try {
    const [tasks, datasources] = await Promise.all([listDataSyncTasks(), listDatasources()]);
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
  const tasks = get(tasksAtom);
  const selectedId = get(selectedIdAtom);
  if (tasks.length === 0) {
    if (selectedId != null) set(selectedIdAtom, null);
    return;
  }
  if (selectedId == null) {
    set(selectedIdAtom, tasks[0].id);
    return;
  }
  if (!tasks.some((t) => t.id === selectedId)) {
    set(selectedIdAtom, tasks[0].id);
  }
});

export const syncViewFormEffectAtom = atomEffect((get, set) => {
  if (get(isEditingAtom)) return;
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  const task = get(tasksAtom).find((t) => t.id === selectedId);
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
    const tasks = get(tasksAtom);
    if (tasks.length) set(selectedIdAtom, tasks[0].id);
    return;
  }
  const selectedId = get(selectedIdAtom);
  const task = selectedId ? get(tasksAtom).find((x) => x.id === selectedId) : undefined;
  if (task) set(applyFormAtom, taskToFormValues(task));
});

export const submitFormAtom = atom(null, async (get, set) => {
  set(formErrorAtom, null);
  const form = get(formAtom);
  const selectedId = get(selectedIdAtom);
  if (!get(isEditingAtom)) return;
  const name = form.name.trim();
  const formValidationError = validateDataSyncForm(form, get(datasourcesAtom));
  if (formValidationError) {
    set(formErrorAtom, formValidationError);
    return;
  }
  const liveGraph = get(workflowCanvasHandleAtom)?.getGraph();
  const syncWorkflow =
    liveGraph &&
    (liveGraph.nodes.length > 0 ||
      liveGraph.links.length > 0 ||
      liveGraph.workflow_inputs.length > 0 ||
      liveGraph.workflow_outputs.length > 0)
      ? liveGraph
      : form.syncWorkflow;
  const payload: Record<string, unknown> = {
    source_datasource_ids: form.sourceIds.map((x) => x.trim()).filter(Boolean),
    target_datasource_ids: form.targetIds.map((x) => x.trim()).filter(Boolean),
    sync_workflow: syncWorkflow,
  };
  payload.start_date = form.startDate.trim();
  const endDate = form.endDate.trim();
  if (endDate) payload.end_date = endDate;
  const maxRetries = Number.parseInt(form.maxRetries, 10);
  const timeoutSeconds = Number.parseInt(form.timeoutSeconds, 10);
  const cron = form.cronExpr.trim() || null;
  set(isBusyAtom, true);
  try {
    if (selectedId == null) {
      const created = await createDataSyncTask({
        name,
        cron_expr: cron,
        payload,
        enabled: form.enabled,
        max_retries: maxRetries,
        timeout_seconds: timeoutSeconds,
      });
      set(isEditingAtom, false);
      set(selectedIdAtom, created.id);
      await set(refreshPageAtom);
    } else {
      const updated = await updateDataSyncTask(selectedId, {
        name,
        cron_expr: cron,
        payload,
        enabled: form.enabled,
        max_retries: maxRetries,
        timeout_seconds: timeoutSeconds,
      });
      set(applyFormAtom, taskToFormValues(updated));
      set(isEditingAtom, false);
      await set(refreshPageAtom);
    }
  } catch (e) {
    set(formErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(isBusyAtom, false);
  }
});

export const triggerTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  set(isBusyAtom, true);
  set(errorAtom, null);
  try {
    await triggerDataSyncTask(selectedId);
    await set(refreshPageAtom);
    await set(schedulerJobsListAtoms.refreshAtom);
    await set(schedulerActiveJobsAtoms.refreshAtom);
  } catch (e) {
    set(errorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(isBusyAtom, false);
  }
});

export const deleteTaskAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedIdAtom);
  if (!selectedId) return;
  if (!window.confirm('确定删除该同步任务？游标记录将保留在服务端数据库中，直至你手动清理。')) return;
  set(isBusyAtom, true);
  set(errorAtom, null);
  try {
    await deleteDataSyncTask(selectedId);
    set(selectedIdAtom, null);
    set(isEditingAtom, false);
    await set(refreshPageAtom);
  } catch (e) {
    set(errorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(isBusyAtom, false);
  }
});

export const setDetailTabAtom = atom(null, (get, set, tab: DetailTab) => {
  if (tab === 'records' && get(isEditingAtom) && get(selectedIdAtom) == null) return;
  set(detailActiveTabAtom, tab);
});

/** 新建 CSV 目标数据源后刷新目录并选中为目标。 */
export const applyCreatedCsvTargetDatasourceAtom = atom(null, async (_get, set, created: DataSourcePublic) => {
  const datasources = await listDatasources();
  set(datasourcesAtom, datasources);
  const label: DatasourceLabelSnapshot = { name: created.name, type: created.type };
  set(formAtom, (prev) => {
    const targetIds = prev.targetIds.includes(created.id) ? prev.targetIds : [...prev.targetIds, created.id];
    return {
      ...prev,
      targetIds,
      datasourceLabels: { ...prev.datasourceLabels, [created.id]: label },
    };
  });
});
