'use client';

import { useState, type RefObject } from 'react';

import { PanelDetailCard } from '@/components/panel-detail-card';
import { PreprocessingWorkflowEditorBlock } from '@/app/data/data-sets/components/panel/preprocessing-workflow-editor-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { DataSourcePublic } from '@/models/datasource/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/dto';
import { READONLY_CONTROL_SURFACE } from '@/lib/readonly-field';
import { cn } from '@/lib/utils';

type SyncDetailTab = 'config' | 'workflow';

function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export type DataSyncDetailPaneProps = {
  creating: boolean;
  selectedTask: SchedulerTaskPublic | undefined;
  showDetailForm: boolean;
  /** 与数据源页一致：仅新建或点击「编辑」后为 true，侧栏收起 */
  showEditor: boolean;
  datasources: DataSourcePublic[];
  locked: boolean;
  error: string | null;
  formError: string | null;
  name: string;
  sourceIds: string[];
  targetIds: string[];
  cronExpr: string;
  initialStartDate: string;
  endDate: string;
  maxRetries: string;
  timeoutSeconds: string;
  enabled: boolean;
  loading: boolean;
  syncWorkflow: WorkflowGraphPersisted;
  syncWorkflowCanvasKey: number;
  workflowCanvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  onRefresh: () => void;
  onEnterEdit: () => void;
  onCancelForm: () => void;
  onTrigger: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onNameChange: (v: string) => void;
  onSourceIdsChange: (ids: string[]) => void;
  onTargetIdsChange: (ids: string[]) => void;
  onCronChange: (v: string) => void;
  onInitialChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onMaxRetriesChange: (v: string) => void;
  onTimeoutChange: (v: string) => void;
  onEnabledChange: (v: boolean) => void;
};

function DataSyncEmptyActions(props: { loading: boolean; onRefresh: () => void }) {
  const { loading, onRefresh } = props;
  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => onRefresh()}>
      刷新
    </Button>
  );
}

function DataSyncReadonlyActions(props: {
  locked: boolean;
  loading: boolean;
  selectedTask: SchedulerTaskPublic;
  onRefresh: () => void;
  onEnterEdit: () => void;
  onTrigger: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const { locked, loading, selectedTask, onRefresh, onEnterEdit, onTrigger, onToggleEnabled, onDelete } = props;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => onRefresh()}>
        刷新
      </Button>
      <Button type="button" variant="default" size="sm" disabled={locked} onClick={() => onEnterEdit()}>
        编辑
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onTrigger()}>
        触发
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onToggleEnabled()}>
        {selectedTask.enabled ? '停用' : '启用'}
      </Button>
      <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => onDelete()}>
        删除
      </Button>
    </div>
  );
}

function DataSyncEditorActions(props: {
  creating: boolean;
  selectedTask: SchedulerTaskPublic | undefined;
  locked: boolean;
  loading: boolean;
  onRefresh: () => void;
  onCancelForm: () => void;
  onTrigger: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onSubmit: () => void;
}) {
  const {
    creating,
    selectedTask,
    locked,
    loading,
    onRefresh,
    onCancelForm,
    onTrigger,
    onToggleEnabled,
    onDelete,
    onSubmit,
  } = props;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => onRefresh()}>
        刷新
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => onCancelForm()} disabled={locked}>
        取消
      </Button>
      {!creating && selectedTask ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onTrigger()}>
            触发
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onToggleEnabled()}>
            {selectedTask.enabled ? '停用' : '启用'}
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => onDelete()}>
            删除
          </Button>
        </>
      ) : null}
      <Button type="button" size="sm" disabled={locked} onClick={() => onSubmit()}>
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
      const next = [...selectedIds.filter((x) => x !== id), id];
      onChange(next);
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

type DataSyncTaskEditorProps = Omit<
  DataSyncDetailPaneProps,
  'showDetailForm' | 'error' | 'formError' | 'showEditor'
> & {
  readOnly: boolean;
};

function DataSyncTaskPaneActions(props: {
  readOnly: boolean;
  creating: boolean;
  selectedTask: SchedulerTaskPublic | undefined;
  locked: boolean;
  loading: boolean;
  onRefresh: () => void;
  onEnterEdit: () => void;
  onCancelForm: () => void;
  onTrigger: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onSubmit: () => void;
}) {
  const {
    readOnly,
    creating,
    selectedTask,
    locked,
    loading,
    onRefresh,
    onEnterEdit,
    onCancelForm,
    onTrigger,
    onToggleEnabled,
    onDelete,
    onSubmit,
  } = props;
  if (readOnly && selectedTask) {
    return (
      <DataSyncReadonlyActions
        locked={locked}
        loading={loading}
        selectedTask={selectedTask}
        onRefresh={onRefresh}
        onEnterEdit={onEnterEdit}
        onTrigger={onTrigger}
        onToggleEnabled={onToggleEnabled}
        onDelete={onDelete}
      />
    );
  }
  return (
    <DataSyncEditorActions
      creating={creating}
      selectedTask={selectedTask}
      locked={locked}
      loading={loading}
      onRefresh={onRefresh}
      onCancelForm={onCancelForm}
      onTrigger={onTrigger}
      onToggleEnabled={onToggleEnabled}
      onDelete={onDelete}
      onSubmit={onSubmit}
    />
  );
}

function DataSyncTaskEditor(props: DataSyncTaskEditorProps) {
  const {
    creating,
    selectedTask,
    readOnly,
    datasources,
    locked,
    loading,
    name,
    sourceIds,
    targetIds,
    cronExpr,
    initialStartDate,
    endDate,
    maxRetries,
    timeoutSeconds,
    enabled,
    syncWorkflow,
    syncWorkflowCanvasKey,
    workflowCanvasRef,
    onCancelForm,
    onRefresh,
    onEnterEdit,
    onTrigger,
    onToggleEnabled,
    onDelete,
    onSubmit,
    onNameChange,
    onSourceIdsChange,
    onTargetIdsChange,
    onCronChange,
    onInitialChange,
    onEndDateChange,
    onMaxRetriesChange,
    onTimeoutChange,
    onEnabledChange,
  } = props;

  const [activeTab, setActiveTab] = useState<SyncDetailTab>('config');

  const configTabContent = (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
      <FieldGroup className="max-w-5xl gap-6">
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-name">任务名称</FieldLabel>
          <Input
            id="sync-name"
            value={name}
            readOnly={readOnly}
            onChange={(e) => onNameChange(e.target.value)}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <DatasourceCheckboxList
            title="源数据源"
            datasources={datasources}
            selectedIds={sourceIds}
            otherSelectedIds={targetIds}
            readOnly={readOnly}
            onChange={onSourceIdsChange}
          />
          <DatasourceCheckboxList
            title="目标数据源"
            datasources={datasources}
            selectedIds={targetIds}
            otherSelectedIds={sourceIds}
            readOnly={readOnly}
            onChange={onTargetIdsChange}
          />
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-cron">Cron</FieldLabel>
          <Input
            id="sync-cron"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={cronExpr}
            readOnly={readOnly}
            onChange={(e) => onCronChange(e.target.value)}
            placeholder="0 2 * * *"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-init">起始日期</FieldLabel>
          <Input
            id="sync-init"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={initialStartDate}
            readOnly={readOnly}
            onChange={(e) => onInitialChange(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-end">结束日期</FieldLabel>
          <Input
            id="sync-end"
            className={cn('font-mono text-sm', readOnly && READONLY_CONTROL_SURFACE)}
            value={endDate}
            readOnly={readOnly}
            onChange={(e) => onEndDateChange(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="sync-retries">最大重试</FieldLabel>
          <Input
            id="sync-retries"
            value={maxRetries}
            readOnly={readOnly}
            onChange={(e) => onMaxRetriesChange(e.target.value)}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="sync-timeout">超时（秒）</FieldLabel>
          <Input
            id="sync-timeout"
            value={timeoutSeconds}
            readOnly={readOnly}
            onChange={(e) => onTimeoutChange(e.target.value)}
            className={cn(readOnly && READONLY_CONTROL_SURFACE)}
          />
        </Field>

        <Field className="gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={enabled}
              disabled={readOnly}
              onCheckedChange={(v) => onEnabledChange(Boolean(v))}
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

  const workflowTabContent = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60">
        <PreprocessingWorkflowEditorBlock
          className="h-full min-h-[480px]"
          workflow={syncWorkflow}
          canvasKey={syncWorkflowCanvasKey}
          canvasRef={workflowCanvasRef}
          readOnly={readOnly}
        />
      </div>
    </div>
  );

  return (
    <PanelDetailCard
      className="min-h-0 flex-1"
      title={
        <span className="truncate text-lg font-semibold tracking-tight">
          {creating ? '新建数据同步' : name || selectedTask?.name || '数据同步'}
        </span>
      }
      actions={
        <DataSyncTaskPaneActions
          readOnly={readOnly}
          creating={creating}
          selectedTask={selectedTask}
          locked={locked}
          loading={loading}
          onRefresh={onRefresh}
          onEnterEdit={onEnterEdit}
          onCancelForm={onCancelForm}
          onTrigger={onTrigger}
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onSubmit={onSubmit}
        />
      }
      panels={[
        { value: 'config', label: '任务配置', content: configTabContent },
        {
          value: 'workflow',
          label: '同步工作流',
          content: workflowTabContent,
        },
      ]}
      panelActiveTab={activeTab}
      onPanelActiveTabChange={(v) => {
        if (v === 'config' || v === 'workflow') setActiveTab(v);
      }}
    />
  );
}

export function DataSyncDetailPane(props: DataSyncDetailPaneProps) {
  const {
    creating,
    selectedTask,
    showDetailForm,
    showEditor,
    datasources,
    locked,
    error,
    formError,
    loading,
    onRefresh,
    onEnterEdit,
    onCancelForm,
    onTrigger,
    onToggleEnabled,
    onDelete,
    onSubmit,
    ...formProps
  } = props;

  const editorKey = creating
    ? `create:${formProps.sourceIds.join(',')}:${formProps.targetIds.join(',')}`
    : `${selectedTask?.id ?? 'none'}:${formProps.sourceIds.join(',')}:${formProps.targetIds.join(',')}`;

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
            {(creating || selectedTask) && (
              <DataSyncTaskEditor
                key={editorKey}
                readOnly={!showEditor}
                creating={creating}
                selectedTask={selectedTask}
                datasources={datasources}
                locked={locked}
                loading={loading}
                {...formProps}
                onRefresh={onRefresh}
                onEnterEdit={onEnterEdit}
                onCancelForm={onCancelForm}
                onTrigger={onTrigger}
                onToggleEnabled={onToggleEnabled}
                onDelete={onDelete}
                onSubmit={onSubmit}
              />
            )}
          </div>
        </div>
      ) : (
        <PanelDetailCard
          className="min-h-0 flex-1"
          title={<span className="truncate text-lg font-semibold tracking-tight">数据同步</span>}
          actions={<DataSyncEmptyActions loading={loading} onRefresh={onRefresh} />}
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
