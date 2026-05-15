'use client';

import { useLayoutEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { PreprocessingWorkflowEditorBlock } from '@/app/data/data-sets/components/panel/preprocessing-workflow-editor-block';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { DataSourcePublic } from '@/models/datasource/dto';
import {
  cancelDataSyncFormAtom,
  dataSyncCreatingAtom,
  dataSyncDatasourcesAtom,
  dataSyncErrorAtom,
  dataSyncFormAtom,
  dataSyncFormErrorAtom,
  dataSyncLoadingAtom,
  dataSyncLockedAtom,
  dataSyncPanelActiveTabAtom,
  dataSyncSelectedTaskAtom,
  dataSyncShowDetailFormAtom,
  dataSyncShowEditorAtom,
  dataSyncWorkflowCanvasHandleAtom,
  dataSyncWorkflowCanvasKeyAtom,
  deleteDataSyncTaskAtom,
  enterDataSyncEditAtom,
  refreshDataSyncPageAtom,
  setDataSyncDetailTabAtom,
  submitDataSyncFormAtom,
  toggleDataSyncEnabledAtom,
  triggerDataSyncTaskAtom,
} from '@/models/data-sync/panel.atom';
import { DataSyncRecordsTab } from '@/app/data/sync/data-sync-records-tab';
import { READONLY_CONTROL_SURFACE } from '@/lib/readonly-field';
import { cn } from '@/lib/utils';

function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function DataSyncEmptyActions() {
  const loading = useAtomValue(dataSyncLoadingAtom);
  const onRefresh = useSetAtom(refreshDataSyncPageAtom);
  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void onRefresh()}>
      刷新
    </Button>
  );
}

function DataSyncReadonlyActions() {
  const locked = useAtomValue(dataSyncLockedAtom);
  const loading = useAtomValue(dataSyncLoadingAtom);
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  const onRefresh = useSetAtom(refreshDataSyncPageAtom);
  const onEnterEdit = useSetAtom(enterDataSyncEditAtom);
  const onTrigger = useSetAtom(triggerDataSyncTaskAtom);
  const onToggleEnabled = useSetAtom(toggleDataSyncEnabledAtom);
  const onDelete = useSetAtom(deleteDataSyncTaskAtom);

  if (!selectedTask) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void onRefresh()}>
        刷新
      </Button>
      <Button type="button" variant="default" size="sm" disabled={locked} onClick={() => void onEnterEdit()}>
        编辑
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => void onTrigger()}>
        触发
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => void onToggleEnabled()}>
        {selectedTask.enabled ? '停用' : '启用'}
      </Button>
      <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => void onDelete()}>
        删除
      </Button>
    </div>
  );
}

function DataSyncEditorActions() {
  const creating = useAtomValue(dataSyncCreatingAtom);
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  const locked = useAtomValue(dataSyncLockedAtom);
  const loading = useAtomValue(dataSyncLoadingAtom);
  const onRefresh = useSetAtom(refreshDataSyncPageAtom);
  const onCancelForm = useSetAtom(cancelDataSyncFormAtom);
  const onTrigger = useSetAtom(triggerDataSyncTaskAtom);
  const onToggleEnabled = useSetAtom(toggleDataSyncEnabledAtom);
  const onDelete = useSetAtom(deleteDataSyncTaskAtom);
  const onSubmit = useSetAtom(submitDataSyncFormAtom);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void onRefresh()}>
        刷新
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void onCancelForm()} disabled={locked}>
        取消
      </Button>
      {!creating && selectedTask ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => void onTrigger()}>
            触发
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => void onToggleEnabled()}>
            {selectedTask.enabled ? '停用' : '启用'}
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => void onDelete()}>
            删除
          </Button>
        </>
      ) : null}
      <Button type="button" size="sm" disabled={locked} onClick={() => void onSubmit()}>
        保存
      </Button>
    </div>
  );
}

function DatasourceCheckboxList(props: {
  title: string;
  datasources: DataSourcePublic[];
  selectedIds: string[];
  otherSelectedIds: string[];
  readOnly?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { title, datasources, selectedIds, otherSelectedIds, readOnly = false, onChange } = props;

  const toggle = (id: string, checked: boolean) => {
    if (readOnly) return;
    if (checked) {
      onChange([...selectedIds.filter((x) => x !== id), id]);
    } else {
      onChange(selectedIds.filter((x) => x !== id));
    }
  };

  return (
    <Field className="gap-2">
      <FieldLabel>{title}</FieldLabel>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background p-3">
        {datasources.map((d) => {
          const disabledAsOther = otherSelectedIds.includes(d.id);
          const checked = selectedIds.includes(d.id);
          const disabled = readOnly || disabledAsOther;
          return (
            <label
              key={d.id}
              className={cn(
                'flex items-center gap-2 text-sm',
                readOnly ? 'cursor-default' : 'cursor-pointer',
                disabledAsOther && !readOnly && 'cursor-not-allowed opacity-50',
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => {
                  if (disabled) return;
                  toggle(d.id, Boolean(v));
                }}
              />
              <span className="min-w-0 truncate">
                {d.name} <span className="text-muted-foreground">({d.type})</span>
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

function DataSyncTaskConfigTab(props: { readOnly: boolean }) {
  const { readOnly } = props;
  const creating = useAtomValue(dataSyncCreatingAtom);
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  const datasources = useAtomValue(dataSyncDatasourcesAtom);
  const [form, setForm] = useAtom(dataSyncFormAtom);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
      <FieldGroup className="max-w-5xl gap-6">
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-name">任务名称</FieldLabel>
          <Input
            id="sync-name"
            value={form.name}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <DatasourceCheckboxList
            title="源数据源"
            datasources={datasources}
            selectedIds={form.sourceIds}
            otherSelectedIds={form.targetIds}
            readOnly={readOnly}
            onChange={(sourceIds) => setForm((prev) => ({ ...prev, sourceIds }))}
          />
          <DatasourceCheckboxList
            title="目标数据源"
            datasources={datasources}
            selectedIds={form.targetIds}
            otherSelectedIds={form.sourceIds}
            readOnly={readOnly}
            onChange={(targetIds) => setForm((prev) => ({ ...prev, targetIds }))}
          />
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-cron">Cron</FieldLabel>
          <Input
            id="sync-cron"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={form.cronExpr}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, cronExpr: e.target.value }))}
            placeholder="0 2 * * *"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-init">起始日期</FieldLabel>
          <Input
            id="sync-init"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={form.initialStartDate}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, initialStartDate: e.target.value }))}
            placeholder="YYYY-MM-DD"
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-end">结束日期</FieldLabel>
          <Input
            id="sync-end"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={form.endDate}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            placeholder="YYYY-MM-DD"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-retries">最大重试</FieldLabel>
          <Input
            id="sync-retries"
            value={form.maxRetries}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, maxRetries: e.target.value }))}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-timeout">超时（秒）</FieldLabel>
          <Input
            id="sync-timeout"
            value={form.timeoutSeconds}
            readOnly={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, timeoutSeconds: e.target.value }))}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>

        <Field className="gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.enabled}
              disabled={readOnly}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, enabled: Boolean(v) }))}
              id="sync-enabled"
            />
            <FieldLabel htmlFor="sync-enabled" className="font-normal">
              启用调度
            </FieldLabel>
          </div>
        </Field>

        {!creating && selectedTask ? (
          <div className="text-xs text-muted-foreground">
            <p>任务 ID：{selectedTask.id}</p>
            <p>更新于：{toLocalTime(selectedTask.updated_at)}</p>
            {readOnly ? <p>下次运行：{toLocalTime(selectedTask.next_run_at)}</p> : null}
          </div>
        ) : null}
      </FieldGroup>
    </div>
  );
}

function DataSyncTaskPaneActions(props: { readOnly: boolean }) {
  const { readOnly } = props;
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  if (readOnly && selectedTask) return <DataSyncReadonlyActions />;
  return <DataSyncEditorActions />;
}

function DataSyncWorkflowTab(props: { readOnly: boolean }) {
  const { readOnly } = props;
  const form = useAtomValue(dataSyncFormAtom);
  const canvasKey = useAtomValue(dataSyncWorkflowCanvasKeyAtom);
  const panelActiveTab = useAtomValue(dataSyncPanelActiveTabAtom);
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);
  const setCanvasHandle = useSetAtom(dataSyncWorkflowCanvasHandleAtom);

  useLayoutEffect(() => {
    setCanvasHandle(canvasRef.current);
    return () => setCanvasHandle(null);
  }, [canvasKey, panelActiveTab, setCanvasHandle]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60">
        <PreprocessingWorkflowEditorBlock
          className="h-full min-h-[480px]"
          workflow={form.syncWorkflow}
          canvasKey={canvasKey}
          canvasRef={canvasRef}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

function DataSyncTaskEditor(props: { readOnly: boolean }) {
  const { readOnly } = props;
  const creating = useAtomValue(dataSyncCreatingAtom);
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  const form = useAtomValue(dataSyncFormAtom);
  const panelActiveTab = useAtomValue(dataSyncPanelActiveTabAtom);
  const setDetailTab = useSetAtom(setDataSyncDetailTabAtom);

  return (
    <PanelDetailCard
      className="min-h-0 flex-1"
      title={
        <span className="truncate text-lg font-semibold tracking-tight">
          {creating ? '新建数据同步' : form.name || selectedTask?.name || '数据同步'}
        </span>
      }
      actions={<DataSyncTaskPaneActions readOnly={readOnly} />}
      panels={[
        { value: 'config', label: '任务配置', content: <DataSyncTaskConfigTab readOnly={readOnly} /> },
        { value: 'workflow', label: '同步工作流', content: <DataSyncWorkflowTab readOnly={readOnly} /> },
        {
          value: 'records',
          label: '同步记录',
          content: <DataSyncRecordsTab />,
          disabled: creating,
        },
      ]}
      panelActiveTab={panelActiveTab}
      onPanelActiveTabChange={(v) => {
        if (v === 'config' || v === 'workflow' || v === 'records') {
          void setDetailTab(v);
        }
      }}
    />
  );
}

export function DataSyncDetailPane() {
  const showDetailForm = useAtomValue(dataSyncShowDetailFormAtom);
  const showEditor = useAtomValue(dataSyncShowEditorAtom);
  const creating = useAtomValue(dataSyncCreatingAtom);
  const selectedTask = useAtomValue(dataSyncSelectedTaskAtom);
  const datasources = useAtomValue(dataSyncDatasourcesAtom);
  const error = useAtomValue(dataSyncErrorAtom);
  const formError = useAtomValue(dataSyncFormErrorAtom);
  const form = useAtomValue(dataSyncFormAtom);

  const editorKey = creating
    ? `create:${form.sourceIds.join(',')}:${form.targetIds.join(',')}`
    : `${selectedTask?.id ?? 'none'}:${form.sourceIds.join(',')}:${form.targetIds.join(',')}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showDetailForm ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {error || formError ? (
            <div className="flex shrink-0 flex-col gap-2">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>操作失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>无法保存</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {(creating || selectedTask) && <DataSyncTaskEditor key={editorKey} readOnly={!showEditor} />}
          </div>
        </div>
      ) : (
        <PanelDetailCard
          className="min-h-0 flex-1"
          title={<span className="truncate text-lg font-semibold tracking-tight">数据同步</span>}
          actions={<DataSyncEmptyActions />}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>操作失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Alert>
              <AlertDescription>
                {datasources.length < 2 ? '至少配置两个数据源。' : '请选择任务或新建。'}
              </AlertDescription>
            </Alert>
          </div>
        </PanelDetailCard>
      )}
    </div>
  );
}
