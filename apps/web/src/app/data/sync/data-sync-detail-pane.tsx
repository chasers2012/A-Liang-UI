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
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { DataSourcePublic } from '@/models/datasource/dto';
import {
  cancelFormAtom,
  datasourcesAtom,
  errorAtom,
  formAtom,
  isBusyAtom,
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

function DataSyncDetailActions() {
  const isEditing = useAtomValue(isEditingAtom);
  const locked = useAtomValue(isBusyAtom);
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

function DatasourceComboboxField(props: {
  title: string;
  datasources: DataSourcePublic[];
  selectedIds: string[];
  otherSelectedIds: string[];
  readOnly: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { title, datasources, selectedIds, otherSelectedIds, readOnly, onChange } = props;
  const anchor = useComboboxAnchor();

  const items = useMemo(() => datasources.map((d) => d.id), [datasources]);

  return (
    <Field className="gap-2">
      <FieldLabel>{title}</FieldLabel>
      <Combobox
        items={items}
        multiple
        value={selectedIds}
        onValueChange={onChange}
        openOnInputClick
        disabled={readOnly}
      >
        <ComboboxChips ref={anchor} className="w-full min-w-0">
          <ComboboxValue>
            {(value: string[]) => (
              <>
                {value.map((id) => {
                  const datasource = datasources.find((d) => d.id === id);
                  if (!datasource) return null;
                  return (
                    <ComboboxChip key={id}>
                      {datasource.name} <span className="text-muted-foreground">({datasource.type})</span>
                    </ComboboxChip>
                  );
                })}
                <ComboboxChipsInput placeholder={readOnly ? '只读' : '选择数据源'} />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent
          anchor={anchor}
          sideOffset={4}
          align="start"
          className="w-max max-w-[min(28rem,var(--available-width))]"
        >
          <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">没有可选数据源</ComboboxEmpty>
          <ComboboxList className="outline-none">
            {(item: string) => {
              const datasource = datasources.find((d) => d.id === item);
              if (!datasource) return null;
              const disabledAsOther = otherSelectedIds.includes(datasource.id);
              return (
                <ComboboxItem
                  key={datasource.id}
                  value={datasource.id}
                  disabled={disabledAsOther}
                  className="items-start"
                >
                  <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">
                    {datasource.name} <span className="text-muted-foreground">({datasource.type})</span>
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function DataSyncConfigFields() {
  const selectedId = useAtomValue(selectedIdAtom);
  const isEditing = useAtomValue(isEditingAtom);
  const datasources = useAtomValue(datasourcesAtom);
  const [form, setForm] = useAtom(formAtom);

  if (selectedId == null && !isEditing) return null;

  const readOnly = !isEditing;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
      <FieldGroup className="max-w-5xl gap-6">
        <div className="grid gap-6">
          <DatasourceComboboxField
            title="源数据源"
            datasources={datasources}
            selectedIds={form.sourceIds}
            otherSelectedIds={form.targetIds}
            readOnly={readOnly}
            onChange={(sourceIds) => setForm((prev) => ({ ...prev, sourceIds }))}
          />
          <DatasourceComboboxField
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

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field className="gap-2">
            <FieldLabel htmlFor="sync-init">起始日期</FieldLabel>
            <DatePicker
              id="sync-init"
              value={form.initialStartDate}
              onChange={(v) => {
                if (readOnly) return;
                setForm((prev) => ({ ...prev, initialStartDate: v }));
              }}
              placeholder="选择起始日期"
              readOnly={readOnly}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="sync-end">结束日期</FieldLabel>
            <DatePicker
              id="sync-end"
              value={form.endDate}
              onChange={(v) => {
                if (readOnly) return;
                setForm((prev) => ({ ...prev, endDate: v }));
              }}
              placeholder="选择结束日期"
              readOnly={readOnly}
            />
          </Field>
        </FieldGroup>

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
