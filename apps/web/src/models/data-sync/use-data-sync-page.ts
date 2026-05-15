'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { listDatasources } from '@/api/datasources';
import {
  createSchedulerTask,
  deleteSchedulerTask,
  listSchedulerTasks,
  triggerSchedulerTask,
  updateSchedulerTask,
} from '@/api/scheduler';
import { useNavigationEditGuardState } from '@/components/navigation-edit-guard-context';
import { parsePersistedWorkflowGraphPayload, type WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
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
import {
  commitDataSyncFormValues,
  emptyDataSyncFormValues,
  taskToFormValues,
  type DataSyncFormCommitters,
  type DataSyncFormValues,
} from './task-form';

export function useDataSyncPage(workflowCanvasRef: RefObject<WorkflowGraphCanvasHandle | null>) {
  const [tasks, setTasks] = useState<SchedulerTaskPublic[]>([]);
  const [datasources, setDatasources] = useState<DataSourcePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [panelEditing, setPanelEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [cronExpr, setCronExpr] = useState('');
  const [initialStartDate, setInitialStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxRetries, setMaxRetries] = useState('3');
  const [timeoutSeconds, setTimeoutSeconds] = useState('300');
  const [enabled, setEnabled] = useState(true);
  const [syncWorkflow, setSyncWorkflow] = useState<WorkflowGraphPersisted>(() =>
    parsePersistedWorkflowGraphPayload({}),
  );
  const [syncWorkflowCanvasKey, setSyncWorkflowCanvasKey] = useState(0);

  const formApplyRef = useRef<DataSyncFormCommitters>({} as DataSyncFormCommitters);
  formApplyRef.current = {
    setName,
    setCronExpr,
    setMaxRetries,
    setTimeoutSeconds,
    setEnabled,
    setSourceIds,
    setTargetIds,
    setInitialStartDate,
    setEndDate,
    setSyncWorkflow,
    bumpSyncWorkflowCanvasKey: () => setSyncWorkflowCanvasKey((k) => k + 1),
  };

  const applyFromValues = useCallback((v: DataSyncFormValues) => {
    commitDataSyncFormValues(v, formApplyRef.current);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [t, ds] = await Promise.all([listSchedulerTasks(), listDatasources()]);
      setTasks(t);
      setDatasources(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncTasks = useMemo(() => tasks.filter((x) => x.task_type === DATASOURCE_SYNC_TASK_TYPE), [tasks]);

  const dsLabelLookup = useMemo(() => buildDatasourceLabelLookup(datasources), [datasources]);

  const describeTask = useCallback(
    (t: SchedulerTaskPublic) => formatDataSyncTaskDescription(t, dsLabelLookup),
    [dsLabelLookup],
  );

  const filteredSyncTasks = useMemo(
    () => filterDataSyncTasksBySearch(syncTasks, listSearchQuery, describeTask),
    [syncTasks, listSearchQuery, describeTask],
  );

  const searchListItems = useMemo(
    () => buildDataSyncSearchListItems(filteredSyncTasks, describeTask),
    [filteredSyncTasks, describeTask],
  );

  const selectedTask = useMemo(
    () => (selectedId ? syncTasks.find((t) => t.id === selectedId) : undefined),
    [syncTasks, selectedId],
  );

  useEffect(() => {
    if (creating) return;
    if (syncTasks.length === 0) {
      if (selectedId != null) setSelectedId(null);
      return;
    }
    if (selectedId == null) {
      setSelectedId(syncTasks[0].id);
      return;
    }
    if (!syncTasks.some((t) => t.id === selectedId)) {
      setSelectedId(syncTasks[0].id);
    }
  }, [syncTasks, selectedId, creating]);

  useEffect(() => {
    if (creating) return;
    if (panelEditing) return;
    if (!selectedId) return;
    const task = syncTasks.find((t) => t.id === selectedId);
    if (task) applyFromValues(taskToFormValues(task));
  }, [syncTasks, selectedId, creating, panelEditing, applyFromValues]);

  const resetForm = useCallback(() => {
    setFormError(null);
    applyFromValues(emptyDataSyncFormValues());
  }, [applyFromValues]);

  const startCreate = useCallback(() => {
    resetForm();
    setPanelEditing(false);
    setCreating(true);
    setSelectedId(null);
  }, [resetForm]);

  const cancelCreate = useCallback(() => {
    setCreating(false);
    setPanelEditing(false);
    setFormError(null);
    if (syncTasks.length) {
      setSelectedId(syncTasks[0].id);
    }
  }, [syncTasks]);

  const onCancelForm = useCallback(() => {
    setFormError(null);
    if (creating) {
      cancelCreate();
      return;
    }
    setPanelEditing(false);
    const t = selectedId ? syncTasks.find((x) => x.id === selectedId) : undefined;
    if (t) applyFromValues(taskToFormValues(t));
  }, [creating, cancelCreate, selectedId, syncTasks, applyFromValues]);

  /** 与数据源页 {@link useNavigationEditGuard} 一致：站内跳转离开本页时若处于新建/编辑表单则确认 */
  useNavigationEditGuardState(creating || panelEditing, { onAbandon: onCancelForm });

  const submitForm = useCallback(async () => {
    setFormError(null);
    const parsed = parseSyncFormForSubmit({
      name,
      sourceIds,
      targetIds,
      initialStartDate,
      endDate,
      maxRetries,
      timeoutSeconds,
      syncWorkflow,
      getLiveWorkflow: () => workflowCanvasRef.current?.getGraph() ?? null,
    });
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }
    const cron = cronExpr.trim() || null;
    setBusyId('__save__');
    try {
      if (creating) {
        const created = await createSchedulerTask({
          name: parsed.name,
          task_type: DATASOURCE_SYNC_TASK_TYPE,
          cron_expr: cron,
          payload: parsed.payload,
          enabled,
          max_retries: parsed.maxRetries,
          timeout_seconds: parsed.timeoutSeconds,
        });
        setCreating(false);
        setPanelEditing(false);
        setSelectedId(created.id);
        await refresh();
      } else if (selectedId) {
        const updated = await updateSchedulerTask(selectedId, {
          name: parsed.name,
          cron_expr: cron,
          payload: parsed.payload,
          enabled,
          max_retries: parsed.maxRetries,
          timeout_seconds: parsed.timeoutSeconds,
        });
        applyFromValues(taskToFormValues(updated));
        setPanelEditing(false);
        await refresh();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [
    creating,
    cronExpr,
    enabled,
    endDate,
    applyFromValues,
    initialStartDate,
    maxRetries,
    name,
    refresh,
    selectedId,
    sourceIds,
    targetIds,
    timeoutSeconds,
    syncWorkflow,
    workflowCanvasRef,
  ]);

  const onToggleEnabled = useCallback(async () => {
    if (!selectedTask) return;
    setBusyId(selectedTask.id);
    setError(null);
    try {
      await updateSchedulerTask(selectedTask.id, { enabled: !selectedTask.enabled });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [selectedTask, refresh]);

  const onTrigger = useCallback(async () => {
    if (!selectedId) return;
    setBusyId(selectedId);
    setError(null);
    try {
      await triggerSchedulerTask(selectedId, {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [selectedId, refresh]);

  const onDelete = useCallback(async () => {
    if (!selectedId) return;
    if (!window.confirm('确定删除该同步任务？游标记录将保留在服务端数据库中，直至你手动清理。')) return;
    setBusyId(selectedId);
    setError(null);
    try {
      await deleteSchedulerTask(selectedId);
      setSelectedId(null);
      setCreating(false);
      setPanelEditing(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [selectedId, refresh]);

  const listNotice = useMemo(
    () =>
      buildDataSyncListNotice({
        error,
        loading,
        syncTasksLength: syncTasks.length,
        filteredCount: filteredSyncTasks.length,
        datasourcesCount: datasources.length,
      }),
    [error, loading, syncTasks.length, filteredSyncTasks.length, datasources.length],
  );

  const showDetailForm = creating || Boolean(selectedTask);
  const showEditor = creating || panelEditing;
  const sidebarCollapsed = showEditor;
  const taskSummary = useMemo(() => (selectedTask ? describeTask(selectedTask) : ''), [selectedTask, describeTask]);
  const locked = busyId != null;

  return {
    listPane: {
      sidebarCollapsed,
      selectedId,
      listSearchQuery,
      onListSearchQueryChange: setListSearchQuery,
      loading,
      datasources,
      searchListItems,
      syncTasksCount: syncTasks.length,
      listNotice,
      onStartCreate: startCreate,
      onSelectItem: (id: string) => {
        setCreating(false);
        setPanelEditing(false);
        setSelectedId(id);
      },
    },
    detailPane: {
      creating,
      selectedTask,
      showDetailForm,
      showEditor,
      taskSummary,
      datasources,
      locked,
      error,
      formError,
      name,
      sourceIds,
      targetIds,
      cronExpr,
      initialStartDate,
      endDate,
      maxRetries,
      timeoutSeconds,
      enabled,
      loading,
      syncWorkflow,
      syncWorkflowCanvasKey,
      workflowCanvasRef,
      onRefresh: () => void refresh(),
      onEnterEdit: () => setPanelEditing(true),
      onCancelForm,
      onTrigger: () => void onTrigger(),
      onToggleEnabled: () => void onToggleEnabled(),
      onDelete: () => void onDelete(),
      onSubmit: () => void submitForm(),
      onNameChange: setName,
      onSourceIdsChange: setSourceIds,
      onTargetIdsChange: setTargetIds,
      onCronChange: setCronExpr,
      onInitialChange: setInitialStartDate,
      onEndDateChange: setEndDate,
      onMaxRetriesChange: setMaxRetries,
      onTimeoutChange: setTimeoutSeconds,
      onEnabledChange: setEnabled,
    },
  };
}
