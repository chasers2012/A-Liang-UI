"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { FactorEditPageDescription } from "@/features/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import { cn } from "@/lib/utils";
import {
  ApiError,
  createDataSet,
  getDataSet,
  getDatasourceDependencyFields,
  listDatasources,
  patchDataSet,
  type DataSetPublic,
  type DataSourcePublic,
} from "@/lib/quant-agent-api";

export type DataSetBindingFormRow = {
  datasource_id: string;
  /** 因子依赖列名；顺序为预设字段在前，其余按填写顺序 */
  dependencies: string[];
};

export type DataSetFormState = {
  name: string;
  description: string;
  bindings: DataSetBindingFormRow[];
  start: string;
  end: string;
  stock_codes_text: string;
};

export function emptyDataSetForm(): DataSetFormState {
  return {
    name: "",
    description: "",
    bindings: [{ datasource_id: "", dependencies: [] }],
    start: "2023-01-01",
    end: "2024-12-31",
    stock_codes_text: "",
  };
}

function toDateInputValue(s: string): string {
  const t = (s || "").trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function hydrateDataSetForm(row: DataSetPublic): DataSetFormState {
  const bindings =
    row.datasource_bindings.length > 0
      ? row.datasource_bindings.map((b) => ({
        datasource_id: b.datasource_id,
        dependencies: normalizeBindingDependencies(b.dependencies, []),
      }))
      : [{ datasource_id: "", dependencies: [] }];
  return {
    name: row.name,
    description: row.description,
    bindings,
    start: toDateInputValue(row.start),
    end: toDateInputValue(row.end),
    stock_codes_text: row.stock_codes.length
      ? row.stock_codes.join("\n")
      : "",
  };
}

export function parseStockCodesFromText(text: string): string[] {
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

/** 按数据源给出的字段顺序排列已选依赖，并保留不在列表中的历史项（兼容旧数据） */
function normalizeBindingDependencies(
  deps: string[],
  preferredOrder: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of preferredOrder) {
    if (deps.includes(f) && !seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  for (const d of deps) {
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

function preferredFieldOrderForDatasource(
  ds: DataSourcePublic | undefined,
  csvDepFieldsById: Record<string, string[]>,
): string[] {
  if (!ds) return [];
  if (ds.type === "sql" && ds.sql) {
    return Object.keys(ds.sql.column_map)
      .filter((k) => k.trim())
      .sort((a, b) => a.localeCompare(b));
  }
  if (ds.type === "csv") {
    return csvDepFieldsById[ds.id] ?? [];
  }
  return [];
}

const DATA_SET_MAIN_FORM_ID = "data-set-main-form";

type BindingDependencyMessagesProps = {
  csvLoading: boolean;
  sqlMapEmpty: boolean;
  csvNoDataColumns: boolean;
  extras: string[];
};

function BindingDependencyMessages({
  csvLoading,
  sqlMapEmpty,
  csvNoDataColumns,
  extras,
}: BindingDependencyMessagesProps) {
  return (
    <>
      {csvLoading ? (
        <p className="text-xs text-muted-foreground">
          正在加载该数据源可用字段…
        </p>
      ) : null}
      {sqlMapEmpty ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          该 SQL 数据源尚未配置字段映射（column_map），请先在「数据源」中保存映射后再勾选依赖。
        </p>
      ) : null}
      {csvNoDataColumns ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          未能从 CSV
          读取到数据列（或仅剩日期/资产列）。请检查数据源路径与文件可读性。
        </p>
      ) : null}
      {extras.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          已保存且不在当前列表中的依赖：{" "}
          <span className="font-mono">{extras.join(", ")}</span>
          （仍会提交；若需调整请修改数据源或取消勾选后保存）
        </p>
      ) : null}
    </>
  );
}

type BindingDependencyCheckboxListProps = {
  row: DataSetBindingFormRow;
  fields: string[];
  index: number;
  updateBinding: (i: number, patch: Partial<DataSetBindingFormRow>) => void;
};

function BindingDependencyCheckboxList({
  row,
  fields,
  index,
  updateBinding,
}: BindingDependencyCheckboxListProps) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-border/60 bg-background/50 px-3 py-3">
      {fields.map((field) => (
        <Label
          key={field}
          className="flex cursor-pointer items-center gap-2 font-normal"
        >
          <input
            type="checkbox"
            className={cn(
              "size-4 shrink-0 rounded border border-input accent-primary",
              "cursor-pointer",
            )}
            checked={row.dependencies.includes(field)}
            onChange={(e) => {
              const on = e.target.checked;
              const next = on
                ? normalizeBindingDependencies(
                  [...row.dependencies, field],
                  fields,
                )
                : normalizeBindingDependencies(
                  row.dependencies.filter((d) => d !== field),
                  fields,
                );
              updateBinding(index, { dependencies: next });
            }}
          />
          <span className="font-mono text-sm">{field}</span>
        </Label>
      ))}
    </div>
  );
}

type DataSetBindingRowBlockProps = {
  index: number;
  row: DataSetBindingFormRow;
  bindingsLength: number;
  datasources: DataSourcePublic[];
  csvDepFields: Record<string, string[]>;
  dsItems: Record<string, string>;
  enabledDs: DataSourcePublic[];
  updateBinding: (i: number, patch: Partial<DataSetBindingFormRow>) => void;
  removeBinding: (i: number) => void;
};

function DataSetBindingRowBlock({
  index,
  row,
  bindingsLength,
  datasources,
  csvDepFields,
  dsItems,
  enabledDs,
  updateBinding,
  removeBinding,
}: DataSetBindingRowBlockProps) {
  const ds = datasources.find((d) => d.id === row.datasource_id.trim());
  const fields = preferredFieldOrderForDatasource(ds, csvDepFields);
  const trimmedId = row.datasource_id.trim();
  const csvLoading =
    !!ds &&
    ds.type === "csv" &&
    !!trimmedId &&
    !Object.prototype.hasOwnProperty.call(csvDepFields, trimmedId);
  const extras = row.dependencies.filter((d) => !fields.includes(d));
  const sqlMapEmpty =
    ds?.type === "sql" &&
    !!ds.sql &&
    Object.keys(ds.sql.column_map).length === 0;
  const csvNoDataColumns =
    ds?.type === "csv" && !csvLoading && Boolean(trimmedId) && fields.length === 0;

  return (
    <div
      className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          绑定 {index + 1}
        </span>
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
          onValueChange={(v) => v && updateBinding(index, { datasource_id: v })}
          disabled={enabledDs.length === 0}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enabledDs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} ({d.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>依赖字段</Label>
          <p className="text-xs text-muted-foreground">
            选项来自该数据源配置（SQL 为字段映射的键名，CSV
            为文件表头中的数据列）。单数据源时可全不选，表示使用因子全部依赖；多数据源时须至少选择一项。
          </p>
          <BindingDependencyMessages
            csvLoading={csvLoading}
            sqlMapEmpty={sqlMapEmpty}
            csvNoDataColumns={csvNoDataColumns}
            extras={extras}
          />
          <BindingDependencyCheckboxList
            row={row}
            fields={fields}
            index={index}
            updateBinding={updateBinding}
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  mode: "create" | "edit";
  dataSetId?: string;
};

export function DataSetForm({ mode, dataSetId }: Props) {
  const router = useRouter();
  const [datasources, setDatasources] = useState<DataSourcePublic[]>([]);
  const [form, setForm] = useState<DataSetFormState>(emptyDataSetForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** CSV 数据源的依赖字段（表头），按数据源 id 缓存 */
  const [csvDepFields, setCsvDepFields] = useState<Record<string, string[]>>({});
  const csvDepLoadedRef = useRef(new Set<string>());

  const set = useCallback((patch: Partial<DataSetFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const updateBinding = useCallback(
    (index: number, patch: Partial<DataSetBindingFormRow>) => {
      setForm((f) => ({
        ...f,
        bindings: f.bindings.map((row, i) =>
          i === index ? { ...row, ...patch } : row,
        ),
      }));
    },
    [],
  );

  const addBinding = useCallback(() => {
    setForm((f) => ({
      ...f,
      bindings: [...f.bindings, { datasource_id: "", dependencies: [] }],
    }));
  }, []);

  const removeBinding = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      bindings:
        f.bindings.length <= 1 ? f.bindings : f.bindings.filter((_, i) => i !== index),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadError(null);
      try {
        const ds = await listDatasources();
        if (cancelled) return;
        setDatasources(ds);
        if (mode === "edit" && dataSetId) {
          const row = await getDataSet(dataSetId);
          if (cancelled) return;
          setForm(hydrateDataSetForm(row));
        } else if (mode === "create") {
          const enabled = ds.filter((d) => d.enabled);
          if (enabled.length === 1) {
            setForm((prev) => ({
              ...prev,
              bindings: [{ datasource_id: enabled[0].id, dependencies: [] }],
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
    const ids = [
      ...new Set(
        form.bindings
          .map((b) => b.datasource_id.trim())
          .filter(Boolean),
      ),
    ];
    for (const id of ids) {
      const ds = datasources.find((d) => d.id === id);
      if (ds?.type !== "csv") continue;
      if (csvDepLoadedRef.current.has(id)) continue;
      csvDepLoadedRef.current.add(id);
      void getDatasourceDependencyFields(id).then(
        (r) =>
          setCsvDepFields((prev) => ({
            ...prev,
            [id]: r.fields,
          })),
        () => {
          setCsvDepFields((prev) => ({ ...prev, [id]: [] }));
        },
      );
    }
  }, [form.bindings, datasources]);

  const enabledDs = datasources.filter((d) => d.enabled);
  const dsItems: Record<string, string> = {};
  for (const d of enabledDs) {
    dsItems[d.id] = `${d.name} (${d.type})`;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    if (!name) {
      setFormError("名称不能为空");
      return;
    }
    if (!form.bindings.length) {
      setFormError("至少保留一条数据源绑定");
      return;
    }
    for (const b of form.bindings) {
      if (!b.datasource_id.trim()) {
        setFormError("每条绑定须选择数据源");
        return;
      }
    }
    if (form.bindings.length > 1) {
      for (const b of form.bindings) {
        if (!b.dependencies.length) {
          setFormError("多个数据源时，每条绑定须至少勾选一个依赖字段");
          return;
        }
      }
    }
    const stock_codes = parseStockCodesFromText(form.stock_codes_text);
    const datasource_bindings = form.bindings.map((b) => ({
      datasource_id: b.datasource_id.trim(),
      dependencies: normalizeBindingDependencies(
        b.dependencies,
        preferredFieldOrderForDatasource(
          datasources.find((d) => d.id === b.datasource_id.trim()),
          csvDepFields,
        ),
      ),
    }));
    const payload = {
      name,
      description: form.description.trim(),
      datasource_bindings,
      start: form.start.trim(),
      end: form.end.trim(),
      stock_codes,
    };
    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createDataSet(payload);
        router.push(`/data/data-sets/${encodeURIComponent(created.id)}`);
      } else if (dataSetId) {
        await patchDataSet(dataSetId, payload);
        router.push(`/data/data-sets/${encodeURIComponent(dataSetId)}`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
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

  if (loadError && mode === "edit") {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据集</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link href="/data/data-sets" className={cn(buttonVariants({ variant: "outline" }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page
      gap="none"
      title={
        <FactorEditPageTitle
          name={form.name}
          onNameChange={(n) => set({ name: n })}
          nameAriaLabel="数据集名称"
        />
      }
      description={
        <FactorEditPageDescription
          description={form.description}
          onDescriptionChange={(d) => set({ description: d })}
          descriptionAriaLabel="数据集说明"
        />
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={DATA_SET_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={enabledDs.length === 0 || !form.name.trim()}
          cancelHref={
            mode === "edit" && dataSetId
              ? `/data/data-sets/${encodeURIComponent(dataSetId)}`
              : "/data/data-sets"
          }
        />
      }
    >
      <form
        id={DATA_SET_MAIN_FORM_ID}
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-8"
      >
        {enabledDs.length === 0 ? (
          <Alert variant="destructive">
            <AlertTitle>无可用数据源</AlertTitle>
            <AlertDescription>
              请先在「数据源」中启用至少一个数据源。
            </AlertDescription>
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>提交失败</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-sm text-muted-foreground">
          可配置多条数据源绑定；仅一条且未选依赖字段时，运行评价将使用因子的全部 dependencies。
        </p>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle>数据源绑定</CardTitle>
                <CardDescription>
                  每条绑定对应一个已启用数据源及其提供的因子依赖列；多源时须为每条绑定勾选或填写依赖。
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
                datasources={datasources}
                csvDepFields={csvDepFields}
                dsItems={dsItems}
                enabledDs={enabledDs}
                updateBinding={updateBinding}
                removeBinding={removeBinding}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>评价区间与参数</CardTitle>
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
              <Label htmlFor="ts-stocks">股票代码（可选）</Label>
              <Textarea
                id="ts-stocks"
                value={form.stock_codes_text}
                onChange={(e) => set({ stock_codes_text: e.target.value })}
                placeholder="每行一个或逗号分隔；留空表示不限制标的范围"
                rows={4}
                className="min-h-0 resize-y font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

      </form>
    </Page>
  );
}
