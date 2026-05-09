'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Page } from '@/components/page';
import { PageFormHeaderActions } from '@/components/page-form-header-actions';
import { EditablePageDescription } from '@/components/editable-page-description';
import { EditablePageTitle } from '@/components/editable-page-title';
import { Stepper, StepperItem } from '@/components/reui/stepper';
import { cn } from '@/lib/utils';
import { defaultNewName } from '@/lib/default-new-name';
import { ApiError } from '@/api/client';
import { createDataSet, getDataSet, getDataSetWorkflowTemplate, patchDataSet } from '@/api/data-sets';
import { getDatasourceDependencyFields, listDatasources } from '@/api/datasources';
import type { DataSetPublic } from '@/models/data-set/dto';
import type { DataSourcePublic } from '@/models/datasource/dto';

import { parsePersistedWorkflowGraphPayload, type WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { syncSystemPreprocessingWorkflow } from './system-preprocessing-node-types';
import { PreprocessingWorkflowEditorBlock } from './preprocessing-workflow-editor-block';

export type DataSetBindingFormRow = {
  datasource_id: string;
  columns: string[];
};

export type DataSetFormState = {
  name: string;
  description: string;
  bindings: DataSetBindingFormRow[];
  preprocessing_workflow: WorkflowGraphPersisted;
  start: string;
  end: string;
  instrument_codes_text: string;
};

export function emptyDataSetForm(template?: WorkflowGraphPersisted): DataSetFormState {
  const preprocessingWorkflow = template ?? parsePersistedWorkflowGraphPayload({});
  return {
    // Avoid hydration mismatch: timestamped defaults must be generated client-side.
    name: '',
    description: '',
    bindings: [
      {
        datasource_id: '',
        columns: [],
      },
    ],
    preprocessing_workflow: preprocessingWorkflow,
    start: '2023-01-01',
    end: '2024-12-31',
    instrument_codes_text: '',
  };
}

function sameWorkflowGraph(a: WorkflowGraphPersisted, b: WorkflowGraphPersisted): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toDateInputValue(s: string): string {
  const t = (s || '').trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function hydrateDataSetForm(row: DataSetPublic): DataSetFormState {
  const bindings =
    row.datasource_bindings.length > 0
      ? row.datasource_bindings.map((b) => ({
          datasource_id: b.datasource_id,
          columns: b.columns ?? [],
        }))
      : [
          {
            datasource_id: '',
            columns: [],
          },
        ];
  return {
    name: row.name,
    description: row.description,
    bindings,
    preprocessing_workflow: row.preprocessing_workflow,
    start: toDateInputValue(row.start),
    end: toDateInputValue(row.end),
    instrument_codes_text: row.instrument_codes.length ? row.instrument_codes.join('\n') : '',
  };
}

export function parseInstrumentCodesFromText(text: string): string[] {
  const parts = text.split(/[\s,;，；]+/u);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const c = p.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function safeParseJsonObject(text: string): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('config 必须是 JSON object（形如 { ... }）');
  }
  return parsed as Record<string, unknown>;
}

function validateDataSetBindings(bindings: DataSetBindingFormRow[]): string | null {
  if (!bindings.length) return '至少保留一条数据源绑定';
  if (bindings.length > 1) return '不支持多数据源绑定（请仅配置一条绑定）';
  for (const b of bindings) {
    if (!b.datasource_id.trim()) return '每条绑定须选择数据源';
  }
  return null;
}

function validatePreprocessingWorkflow(workflow: WorkflowGraphPersisted): string | null {
  for (const node of workflow.nodes) {
    const params = node.params ?? {};
    const cfg = params['config_json'];
    if (typeof cfg === 'string' && cfg.trim()) {
      try {
        safeParseJsonObject(cfg);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    }
  }

  return null;
}

const DATA_SET_MAIN_FORM_ID = 'data-set-main-form';

// BindingDependencyMessages removed: dependency mapping UI no longer exists.

type DataSetBindingRowBlockProps = {
  index: number;
  row: DataSetBindingFormRow;
  bindingsLength: number;
  dependencyFieldsByDsId: Record<string, string[]>;
  dsItems: Record<string, string>;
  bindingDatasources: DataSourcePublic[];
  updateBinding: (i: number, patch: Partial<DataSetBindingFormRow>) => void;
  removeBinding: (i: number) => void;
};

function DataSetBindingRowBlock({
  index,
  row,
  bindingsLength,
  dependencyFieldsByDsId,
  dsItems,
  bindingDatasources,
  updateBinding,
  removeBinding,
}: DataSetBindingRowBlockProps) {
  const trimmedId = row.datasource_id.trim();
  const physicalColumns = dependencyFieldsByDsId[trimmedId] ?? [];
  const columnOptions = (() => {
    const set = new Set<string>();
    for (const c of physicalColumns) {
      const t = String(c).trim();
      if (t) set.add(t);
    }
    return [...set].sort((x, y) => x.localeCompare(y));
  })();
  const useColumnSelects = columnOptions.length > 0;
  const columnsAnchor = useComboboxAnchor();

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">绑定 {index + 1}</span>
        {bindingsLength > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-destructive"
            onClick={() => removeBinding(index)}
          >
            <Minus className="size-4" />
            移除
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>数据源</Label>
        <Select
          modal={false}
          items={dsItems}
          value={row.datasource_id}
          onValueChange={(v) =>
            v &&
            updateBinding(index, {
              datasource_id: v,
              columns: [],
            })
          }
          disabled={bindingDatasources.length === 0}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bindingDatasources.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} ({d.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          筛选数据列<span className="text-xs text-muted-foreground">留空启用全部</span>
        </Label>
        {useColumnSelects ? (
          <Combobox
            items={columnOptions}
            multiple
            value={row.columns}
            onValueChange={(v) => updateBinding(index, { columns: v ?? [] })}
            openOnInputClick
          >
            <ComboboxChips ref={columnsAnchor} className="w-full min-w-0">
              <ComboboxValue>
                {(value: string[]) => (
                  <>
                    {value.map((c) => (
                      <ComboboxChip key={c} className="font-mono text-xs" aria-label={`移除 ${c}`}>
                        {c}
                      </ComboboxChip>
                    ))}
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent
              anchor={columnsAnchor}
              sideOffset={4}
              align="start"
              className="w-max max-w-[min(28rem,var(--available-width))]"
            >
              <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">无匹配列</ComboboxEmpty>
              <ComboboxList className="outline-none">
                {(item: string) => (
                  <ComboboxItem key={item} value={item} className="items-start text-sm">
                    <span className="min-w-0 flex-1 whitespace-normal wrap-break-word font-mono text-xs">{item}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <p className="text-xs text-muted-foreground">先选择数据源并等待列名加载</p>
        )}
      </div>
    </div>
  );
}

type Props = {
  mode: 'create' | 'edit';
  dataSetId?: string;
};

export function DataSetForm({ mode, dataSetId }: Props) {
  const router = useRouter();
  const [datasources, setDatasources] = useState<DataSourcePublic[]>([]);
  const [preprocessingWorkflowTemplate, setPreprocessingWorkflowTemplate] = useState<WorkflowGraphPersisted | null>(
    null,
  );
  const [form, setForm] = useState<DataSetFormState>(() =>
    mode === 'create' ? emptyDataSetForm() : { ...emptyDataSetForm(), name: '', description: '' },
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);
  /** 数据源可用字段（用于勾选），按数据源 id 缓存 */
  const [dependencyFieldsByDsId, setDependencyFieldsByDsId] = useState<Record<string, string[]>>({});
  const depFieldsLoadedRef = useRef(new Set<string>());

  const set = useCallback((patch: Partial<DataSetFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const updateBinding = useCallback((index: number, patch: Partial<DataSetBindingFormRow>) => {
    setForm((f) => ({
      ...f,
      bindings: f.bindings.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }, []);

  const addBinding = useCallback(() => {
    setForm((f) => ({
      ...f,
      bindings: [
        ...f.bindings,
        {
          datasource_id: '',
          columns: [],
        },
      ],
    }));
  }, []);

  const removeBinding = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      bindings: f.bindings.length <= 1 ? f.bindings : f.bindings.filter((_, i) => i !== index),
    }));
  }, []);

  useEffect(() => {
    if (mode !== 'create') return;
    setForm((f) => (f.name.trim() ? f : { ...f, name: defaultNewName('新数据集') }));
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadError(null);
      try {
        const [ds, workflowTemplateRaw] = await Promise.all([listDatasources(), getDataSetWorkflowTemplate()]);
        const workflowTemplate = parsePersistedWorkflowGraphPayload(workflowTemplateRaw);
        if (cancelled) return;
        setDatasources(ds);
        setPreprocessingWorkflowTemplate(workflowTemplate);
        if (mode === 'edit' && dataSetId) {
          const row = await getDataSet(dataSetId);
          if (cancelled) return;
          setForm(hydrateDataSetForm(row));
          setCanvasKey((k) => k + 1);
        } else if (mode === 'create') {
          setForm((prev) => ({
            ...emptyDataSetForm(workflowTemplate),
            name: prev.name,
            description: prev.description,
            start: prev.start,
            end: prev.end,
            instrument_codes_text: prev.instrument_codes_text,
          }));
          if (ds.length === 1) {
            setForm((prev) => ({
              ...prev,
              bindings: [
                {
                  datasource_id: ds[0].id,
                  columns: [],
                },
              ],
            }));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, dataSetId]);

  useEffect(() => {
    const ids = [...new Set(form.bindings.map((b) => b.datasource_id.trim()).filter(Boolean))];
    for (const id of ids) {
      const ds = datasources.find((d) => d.id === id);
      if (!ds) continue;
      if (depFieldsLoadedRef.current.has(id)) continue;
      depFieldsLoadedRef.current.add(id);
      void getDatasourceDependencyFields(id).then(
        (r) =>
          setDependencyFieldsByDsId((prev) => ({
            ...prev,
            [id]: r.fields,
          })),
        () => {
          setDependencyFieldsByDsId((prev) => ({ ...prev, [id]: [] }));
        },
      );
    }
  }, [form.bindings, datasources]);

  useEffect(() => {
    const datasourceIds = [...new Set(form.bindings.map((b) => b.datasource_id.trim()).filter(Boolean))];
    const datasourceNameById = Object.fromEntries(datasources.map((d) => [d.id, d.name]));
    setForm((prev) => {
      // Always sync against the latest canvas graph first so dataset edits won't
      // override graph edits made directly on the canvas.
      const liveGraph = canvasRef.current?.getGraph();
      const baseWorkflow = liveGraph ?? prev.preprocessing_workflow;
      const syncedWorkflow = syncSystemPreprocessingWorkflow(
        baseWorkflow,
        datasourceIds,
        datasourceNameById,
        preprocessingWorkflowTemplate,
      );
      if (sameWorkflowGraph(prev.preprocessing_workflow, syncedWorkflow) && !liveGraph) {
        return prev;
      }
      return {
        ...prev,
        preprocessing_workflow: syncedWorkflow,
      };
    });
  }, [form.bindings, datasources, preprocessingWorkflowTemplate]);

  const bindingDatasources = datasources;
  const dsItems: Record<string, string> = {};
  for (const d of bindingDatasources) {
    dsItems[d.id] = `${d.name} (${d.type})`;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    if (!name) {
      setFormError('名称不能为空');
      return;
    }
    const bindingsError = validateDataSetBindings(form.bindings);
    if (bindingsError) {
      setFormError(bindingsError);
      return;
    }

    for (const b of form.bindings) {
      const dsId = b.datasource_id.trim();
      if (!dsId) {
        setFormError('请先选择数据源');
        return;
      }
    }

    const rawWorkflow = canvasRef.current?.getGraph() ?? form.preprocessing_workflow;
    const wf = rawWorkflow;
    const wfError = validatePreprocessingWorkflow(wf);
    if (wfError) {
      setFormError(wfError);
      return;
    }
    const instrument_codes = parseInstrumentCodesFromText(form.instrument_codes_text);
    const datasource_bindings = form.bindings.map((b) => ({
      datasource_id: b.datasource_id.trim(),
      columns: (b.columns ?? []).map((c) => c.trim()).filter(Boolean),
    }));
    const payload = {
      name,
      description: form.description.trim(),
      datasource_bindings,
      preprocessing_workflow: wf,
      start: form.start.trim(),
      end: form.end.trim(),
      instrument_codes,
    };
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createDataSet(payload);
        router.push(`/data/data-sets/${encodeURIComponent(created.id)}`);
      } else if (dataSetId) {
        await patchDataSet(dataSetId, payload);
        router.push(`/data/data-sets/${encodeURIComponent(dataSetId)}`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page gap="none">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (loadError && mode === 'edit') {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据集</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link href="/data/data-sets" className={cn(buttonVariants({ variant: 'outline' }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page
      className={cn(activeStep === 1 ? 'h-full overflow-hidden' : undefined)}
      gap="none"
      title={
        <EditablePageTitle
          value={form.name}
          onChange={(n) => set({ name: n })}
          inputAriaLabel="数据集名称"
          editButtonAriaLabel="编辑名称"
        />
      }
      description={
        <EditablePageDescription
          value={form.description}
          onChange={(d) => set({ description: d })}
          textareaAriaLabel="数据集说明"
        />
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={DATA_SET_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={bindingDatasources.length === 0 || !form.name.trim()}
          cancelHref={
            mode === 'edit' && dataSetId ? `/data/data-sets/${encodeURIComponent(dataSetId)}` : '/data/data-sets'
          }
        />
      }
    >
      <form
        id={DATA_SET_MAIN_FORM_ID}
        onSubmit={(e) => void onSubmit(e)}
        className={cn(activeStep === 1 ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden' : 'space-y-8')}
      >
        {bindingDatasources.length === 0 ? (
          <Alert variant="destructive">
            <AlertTitle>无可用数据源</AlertTitle>
            <AlertDescription>请先在「数据源」中新建至少一个数据源。</AlertDescription>
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>提交失败</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Stepper className={cn(activeStep === 1 ? 'shrink-0' : undefined)}>
          <StepperItem
            index={0}
            title="数据源与参数"
            description="绑定数据源，配置评价区间与标的参数"
            active={activeStep === 0}
            completed={activeStep > 0}
            onClick={() => setActiveStep(0)}
          />
          <StepperItem
            index={1}
            title="预处理工作流编辑"
            description="编辑预处理工作流节点与连线"
            active={activeStep === 1}
            onClick={() => setActiveStep(1)}
          />
        </Stepper>

        <div className={cn('space-y-8', activeStep === 0 ? 'block' : 'hidden')}>
          <Card>
            <CardHeader>
              <CardTitle>参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ts-start">开始日期</Label>
                  <DatePicker
                    id="ts-start"
                    value={form.start}
                    onChange={(v) => set({ start: v })}
                    placeholder="选择开始日期"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ts-end">结束日期</Label>
                  <DatePicker
                    id="ts-end"
                    value={form.end}
                    onChange={(v) => set({ end: v })}
                    placeholder="选择结束日期"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-instruments">标的代码（可选）</Label>
                <Textarea
                  id="ts-instruments"
                  value={form.instrument_codes_text}
                  onChange={(e) => set({ instrument_codes_text: e.target.value })}
                  placeholder="每行一个或逗号分隔；留空表示不限制标的范围"
                  rows={4}
                  className="min-h-0 resize-y font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <CardTitle>数据源绑定</CardTitle>
                  <CardDescription>
                    每条绑定对应一个数据源及其提供的因子依赖列；多源时须为每条绑定勾选或填写依赖。
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addBinding}>
                  <Plus className="size-4" />
                  添加数据源
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {form.bindings.map((row, index) => (
                <DataSetBindingRowBlock
                  key={index}
                  index={index}
                  row={row}
                  bindingsLength={form.bindings.length}
                  dependencyFieldsByDsId={dependencyFieldsByDsId}
                  dsItems={dsItems}
                  bindingDatasources={(() => {
                    const currentId = row.datasource_id.trim();
                    const takenIds = new Set(
                      form.bindings.map((b, i) => (i === index ? '' : b.datasource_id.trim())).filter(Boolean),
                    );
                    return bindingDatasources.filter((d) => d.id === currentId || !takenIds.has(d.id));
                  })()}
                  updateBinding={updateBinding}
                  removeBinding={removeBinding}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-hidden', activeStep === 1 ? 'flex' : 'hidden')}>
          <PreprocessingWorkflowEditorBlock
            className="min-h-0 flex-1"
            workflow={form.preprocessing_workflow}
            canvasKey={canvasKey}
            canvasRef={canvasRef}
          />
        </div>
      </form>
    </Page>
  );
}
