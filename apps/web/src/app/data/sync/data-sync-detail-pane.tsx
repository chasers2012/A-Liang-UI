'use client';

import { useLayoutEffect, useMemo, useRef, type SetStateAction } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { PreprocessingWorkflowEditorBlock } from '@/app/data/data-sets/components/panel/preprocessing-workflow-editor-block';
import { DataSyncCronField } from '@/app/data/sync/data-sync-cron-field';
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
import {
  datasourceDisplayLabel,
  isDatasourceDeleted,
  targetDatasourceOptions,
  type DatasourceLabelSnapshot,
} from '@/models/data-sync/task-form';
import { cn } from '@/lib/utils';
import { Section } from '@/components/section';

function DeletedDatasourceBadge() {
  return (
    <span className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
      已删除
    </span>
  );
}

function DatasourceChipLabel(props: {
  id: string;
  live: DataSourcePublic[];
  labels: Record<string, DatasourceLabelSnapshot>;
}) {
  const { id, live, labels } = props;
  const deleted = isDatasourceDeleted(id, live);
  const text = datasourceDisplayLabel(id, live, labels);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{text}</span>
      {deleted ? <DeletedDatasourceBadge /> : null}
    </span>
  );
}

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
  required?: boolean;
  datasources: DataSourcePublic[];
  optionDatasources?: DataSourcePublic[];
  labelSnapshots: Record<string, DatasourceLabelSnapshot>;
  emptyLabel?: string;
  selectedIds: string[];
  otherSelectedIds: string[];
  readOnly: boolean;
  onChange: (ids: string[]) => void;
}) {
  const {
    title,
    required,
    datasources,
    optionDatasources,
    labelSnapshots,
    emptyLabel = '没有可选数据源',
    selectedIds,
    otherSelectedIds,
    readOnly,
    onChange,
  } = props;
  const anchor = useComboboxAnchor();
  const options = optionDatasources ?? datasources;

  const items = useMemo(() => {
    const ids = options.map((d) => d.id);
    const seen = new Set(ids);
    for (const id of selectedIds) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [options, selectedIds]);

  return (
    <Field className="gap-2">
      <FieldLabel>
        {title}
        {required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      <Combobox
        items={items}
        multiple
        value={selectedIds}
        onValueChange={onChange}
        openOnInputClick
        disabled={readOnly}
      >
        <ComboboxChips
          ref={anchor}
          data-readonly={readOnly ? '' : undefined}
          className={cn('w-full min-w-0', readOnly && 'font-normal')}
        >
          <ComboboxValue>
            {(value: string[]) => (
              <>
                {readOnly && value.length === 0 ? (
                  <span className="text-xs text-muted-foreground">（未选择）</span>
                ) : null}
                {value.map((id) => {
                  const label = datasourceDisplayLabel(id, datasources, labelSnapshots);
                  return (
                    <ComboboxChip
                      key={id}
                      className={cn('font-medium text-xs', readOnly && 'opacity-70')}
                      aria-label={readOnly ? label : `移除 ${label}`}
                      showRemove={!readOnly}
                    >
                      <DatasourceChipLabel id={id} live={datasources} labels={labelSnapshots} />
                    </ComboboxChip>
                  );
                })}
                <ComboboxChipsInput placeholder={readOnly ? '' : '选择数据源'} />
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
          <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">{emptyLabel}</ComboboxEmpty>
          <ComboboxList className="outline-none">
            {(item: string) => {
              const datasource = options.find((d) => d.id === item);
              const disabledAsOther = otherSelectedIds.includes(item);
              const deleted = isDatasourceDeleted(item, datasources);
              const label = datasource
                ? `${datasource.name} (${datasource.type})`
                : datasourceDisplayLabel(item, datasources, labelSnapshots);
              return (
                <ComboboxItem key={item} value={item} disabled={disabledAsOther} className="items-start text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-2 whitespace-normal wrap-break-word">
                    <span className="min-w-0 flex-1">{label}</span>
                    {deleted ? <DeletedDatasourceBadge /> : null}
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

  const readOnly = !isEditing;
  const targetOptions = useMemo(
    () => targetDatasourceOptions(datasources, form.targetIds, readOnly),
    [datasources, form.targetIds, readOnly],
  );

  const patchDatasourceLabels = (ids: string[], prevLabels: Record<string, DatasourceLabelSnapshot>) => {
    const nextLabels = { ...prevLabels };
    for (const id of ids) {
      const picked = datasources.find((d) => d.id === id);
      if (picked) nextLabels[id] = { name: picked.name, type: picked.type };
    }
    return nextLabels;
  };

  if (selectedId == null && !isEditing) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2 max-w-5xl ">
      <Section title="数据源">
        <FieldGroup className="mt-6 gap-6">
          <DatasourceComboboxField
            title="源数据源"
            required
            datasources={datasources}
            labelSnapshots={form.datasourceLabels}
            selectedIds={form.sourceIds}
            otherSelectedIds={form.targetIds}
            readOnly={readOnly}
            onChange={(sourceIds) =>
              setForm((prev) => ({
                ...prev,
                sourceIds,
                datasourceLabels: patchDatasourceLabels(sourceIds, prev.datasourceLabels),
              }))
            }
          />
          <DatasourceComboboxField
            title="目标数据源"
            required
            datasources={datasources}
            optionDatasources={targetOptions}
            labelSnapshots={form.datasourceLabels}
            emptyLabel="没有可写入的数据源（请在 SQL 数据源中开启写入）"
            selectedIds={form.targetIds}
            otherSelectedIds={form.sourceIds}
            readOnly={readOnly}
            onChange={(targetIds) =>
              setForm((prev) => ({
                ...prev,
                targetIds,
                datasourceLabels: patchDatasourceLabels(targetIds, prev.datasourceLabels),
              }))
            }
          />
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="sync-init">
                起始日期 <span className="text-destructive">*</span>
              </FieldLabel>
              <DatePicker
                id="sync-init"
                value={form.startDate}
                onChange={(v) => {
                  if (readOnly) return;
                  setForm((prev) => ({ ...prev, startDate: v }));
                }}
                placeholder="选择起始日期"
                required
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
        </FieldGroup>
      </Section>
      <Section title="自动触发">
        <FieldGroup className="mt-6 gap-6">
          <Field className="gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.enabled}
                disabled={readOnly}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, enabled: Boolean(v) }))}
                id="sync-enabled"
              />
              <FieldLabel htmlFor="sync-enabled" className="font-normal">
                启用自动触发
              </FieldLabel>
            </div>
          </Field>
          <Field className="gap-2">
            <FieldLabel id="sync-cron-label">触发于</FieldLabel>
            <DataSyncCronField
              id="sync-cron"
              ariaLabelledBy="sync-cron-label"
              value={form.cronExpr}
              setValue={(v: SetStateAction<string>) =>
                setForm((prev) => ({
                  ...prev,
                  cronExpr: typeof v === 'function' ? v(prev.cronExpr) : v,
                }))
              }
              readOnly={readOnly}
            />
          </Field>

          <Field className="gap-2">
            <FieldLabel htmlFor="sync-retries">最大执行次数</FieldLabel>
            <Input
              id="sync-retries"
              value={form.maxRetries}
              readOnly={readOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, maxRetries: e.target.value }))}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="sync-timeout">超时（秒）</FieldLabel>
            <Input
              id="sync-timeout"
              value={form.timeoutSeconds}
              readOnly={readOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, timeoutSeconds: e.target.value }))}
              className={cn()}
            />
          </Field>
        </FieldGroup>
      </Section>
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
