'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { PreprocessingWorkflowEditorBlock } from '@/app/data/data-sets/components/panel/preprocessing-workflow-editor-block';
import { DataSyncRecordsTab } from '@/app/data/sync/data-sync-records-tab';
import { EditablePageTitle } from '@/components/editable-page-title';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { DataSourcePublic } from '@/models/datasource/dto';
import {
  cancelFormAtom,
  datasourcesAtom,
  errorAtom,
  formAtom,
  busyIdAtom,
  formErrorAtom,
  isEditingAtom,
  panelActiveTabAtom,
  selectedIdAtom,
  selectedTaskAtom,
  workflowCanvasHandleAtom,
  workflowCanvasKeyAtom,
  deleteTaskAtom,
  enterEditAtom,
  setDetailTabAtom,
  submitFormAtom,
  triggerTaskAtom,
} from '@/models/data-sync/panel.atom';
import { READONLY_CONTROL_SURFACE } from '@/lib/readonly-field';
import { cn } from '@/lib/utils';

function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function DataSyncDetailActions() {
  const isEditing = useAtomValue(isEditingAtom);
  const locked = useAtomValue(busyIdAtom) != null;
  const selectedId = useAtomValue(selectedIdAtom);
  const onEnterEdit = useSetAtom(enterEditAtom);
  const onTrigger = useSetAtom(triggerTaskAtom);
  const onDelete = useSetAtom(deleteTaskAtom);
  const onCancelForm = useSetAtom(cancelFormAtom);
  const onSubmit = useSetAtom(submitFormAtom);

  if (isEditing) {
    return (
      <>
        <Button type="button" variant="outline" size="sm" onClick={() => void onCancelForm()} disabled={locked}>
          取消
        </Button>
        <Button type="button" size="sm" disabled={locked} onClick={() => void onSubmit()}>
          保存
        </Button>
      </>
    );
  }

  if (!selectedId) return null;

  return (
    <>
      <Button type="button" variant="default" size="sm" disabled={locked} onClick={() => void onEnterEdit()}>
        编辑
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => void onTrigger()}>
        触发
      </Button>
      <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => void onDelete()}>
        删除
      </Button>
    </>
  );
}

function DatasourceCheckboxList(props: {
  title: string;
  datasources: DataSourcePublic[];
  selectedIds: string[];
  otherSelectedIds: string[];
  readOnly: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { title, datasources, selectedIds, otherSelectedIds, readOnly, onChange } = props;

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

function DataSyncConfigFields() {
  const selectedId = useAtomValue(selectedIdAtom);
  const isEditing = useAtomValue(isEditingAtom);
  const selectedTask = useAtomValue(selectedTaskAtom);
  const datasources = useAtomValue(datasourcesAtom);
  const [form, setForm] = useAtom(formAtom);

  if (selectedId == null && !isEditing) return null;

  const readOnly = !isEditing;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
      <FieldGroup className="max-w-5xl gap-6">
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

        {selectedTask ? (
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

function DataSyncWorkflowFields() {
  const selectedId = useAtomValue(selectedIdAtom);
  const isEditing = useAtomValue(isEditingAtom);
  const form = useAtomValue(formAtom);
  const canvasKey = useAtomValue(workflowCanvasKeyAtom);
  const panelActiveTab = useAtomValue(panelActiveTabAtom);
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);
  const setCanvasHandle = useSetAtom(workflowCanvasHandleAtom);

  useLayoutEffect(() => {
    setCanvasHandle(canvasRef.current);
    return () => setCanvasHandle(null);
  }, [canvasKey, panelActiveTab, setCanvasHandle]);

  if (selectedId == null && !isEditing) return null;

  const readOnly = !isEditing;

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

function DataSyncDetailCardAlerts() {
  const isEditing = useAtomValue(isEditingAtom);
  const selectedId = useAtomValue(selectedIdAtom);
  const error = useAtomValue(errorAtom);
  const formError = useAtomValue(formErrorAtom);

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>操作失败</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (formError && (isEditing || selectedId)) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>无法保存</AlertTitle>
        <AlertDescription>{formError}</AlertDescription>
      </Alert>
    );
  }

  if (!isEditing && !selectedId) {
    return (
      <Alert>
        <AlertDescription>请选择任务或新建。</AlertDescription>
      </Alert>
    );
  }

  return null;
}

function useDataSyncDetailPanels() {
  const isEditing = useAtomValue(isEditingAtom);
  const selectedId = useAtomValue(selectedIdAtom);
  const isCreating = isEditing && selectedId == null;

  return useMemo(
    () =>
      [
        { value: 'config', label: '任务配置', content: <DataSyncConfigFields /> },
        { value: 'workflow', label: '同步工作流', content: <DataSyncWorkflowFields /> },
        {
          value: 'records',
          label: '同步记录',
          content: <DataSyncRecordsTab />,
          disabled: isCreating,
        },
      ] as const,
    [isCreating],
  );
}

/**
 * 右侧主区：全模块仅渲染一个 {@link PanelDetailCard}。
 * 空态 / 只读 / 编辑在 title、actions、panels 与各字段的 readOnly 上区分。
 */
export function DataSyncDetailPane() {
  const isEditing = useAtomValue(isEditingAtom);
  const selectedId = useAtomValue(selectedIdAtom);
  const isCreating = isEditing && selectedId == null;
  const selectedTask = useAtomValue(selectedTaskAtom);
  const [form, setForm] = useAtom(formAtom);
  const panelActiveTab = useAtomValue(panelActiveTabAtom);
  const setDetailTab = useSetAtom(setDetailTabAtom);
  const detailPanels = useDataSyncDetailPanels();

  const pageTitleValue = isEditing ? form.name : (selectedTask?.name ?? '');

  const editorKey = isCreating
    ? `create:${form.sourceIds.join(',')}:${form.targetIds.join(',')}`
    : `${selectedId ?? 'none'}:${form.sourceIds.join(',')}:${form.targetIds.join(',')}`;

  const title = (
    <EditablePageTitle
      value={pageTitleValue}
      showEdit={isEditing}
      onChange={(v) => {
        if (!isEditing) return;
        setForm((prev) => ({ ...prev, name: v }));
      }}
      inputAriaLabel="同步任务名称"
      placeholder={isCreating ? '新建数据同步' : '数据同步'}
      editButtonAriaLabel="编辑任务名称"
    />
  );

  const onPanelActiveTabChange = (v: string) => {
    if (v === 'config' || v === 'workflow' || v === 'records') {
      void setDetailTab(v);
    }
  };

  return (
    <PanelDetailCard
      key={editorKey}
      className="min-h-0 flex-1"
      title={title}
      actions={<DataSyncDetailActions />}
      panels={detailPanels}
      panelActiveTab={panelActiveTab}
      onPanelActiveTabChange={onPanelActiveTabChange}
    >
      <DataSyncDetailCardAlerts />
    </PanelDetailCard>
  );
}
