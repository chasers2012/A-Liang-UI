"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "@/components/page";
import { cn } from "@/lib/utils";
import {
  ApiError,
  createEvaluationTestSet,
  getEvaluationTestSet,
  listDatasources,
  patchEvaluationTestSet,
  type DataSourcePublic,
  type EvaluationTestSetPublic,
} from "@/lib/quant-agent-api";

export type TestSetBindingFormRow = {
  datasource_id: string;
  /** 因子依赖列名；顺序为预设字段在前，其余按填写顺序 */
  dependencies: string[];
};

export type TestSetFormState = {
  name: string;
  description: string;
  bindings: TestSetBindingFormRow[];
  start: string;
  end: string;
  stock_codes_text: string;
  quantiles: string;
  is_default: boolean;
};

export function emptyTestSetForm(): TestSetFormState {
  return {
    name: "",
    description: "",
    bindings: [{ datasource_id: "", dependencies: [] }],
    start: "2023-01-01",
    end: "2024-12-31",
    stock_codes_text: "",
    quantiles: "5",
    is_default: false,
  };
}

function toDateInputValue(s: string): string {
  const t = (s || "").trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function hydrateTestSetForm(row: EvaluationTestSetPublic): TestSetFormState {
  const bindings =
    row.datasource_bindings.length > 0
      ? row.datasource_bindings.map((b) => ({
        datasource_id: b.datasource_id,
        dependencies: normalizeBindingDependencies(b.dependencies),
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
    quantiles: String(row.quantiles),
    is_default: row.is_default,
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

/** 常用行情/量价依赖，与多选框一致；其余名称通过「其它依赖」填写 */
export const PRESET_DEPENDENCY_FIELDS = [
  "open",
  "high",
  "low",
  "close",
  "volume",
  "amount",
  "turn",
  "vwap",
] as const;

const PRESET_DEPENDENCY_SET = new Set<string>(PRESET_DEPENDENCY_FIELDS);

function normalizeBindingDependencies(deps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of PRESET_DEPENDENCY_FIELDS) {
    if (deps.includes(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  for (const d of deps) {
    if (!PRESET_DEPENDENCY_SET.has(d) && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

type Props = {
  mode: "create" | "edit";
  testSetId?: string;
};

export function TestSetForm({ mode, testSetId }: Props) {
  const router = useRouter();
  const [datasources, setDatasources] = useState<DataSourcePublic[]>([]);
  const [form, setForm] = useState<TestSetFormState>(emptyTestSetForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((patch: Partial<TestSetFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const updateBinding = useCallback(
    (index: number, patch: Partial<TestSetBindingFormRow>) => {
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
        if (mode === "edit" && testSetId) {
          const row = await getEvaluationTestSet(testSetId);
          if (cancelled) return;
          setForm(hydrateTestSetForm(row));
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
  }, [mode, testSetId]);

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
          setFormError("多个数据源时，每条绑定须至少勾选一个依赖字段或填写其它依赖");
          return;
        }
      }
    }
    const q = parseInt(form.quantiles, 10);
    if (Number.isNaN(q) || q < 2) {
      setFormError("分位数须为不小于 2 的整数");
      return;
    }
    const stock_codes = parseStockCodesFromText(form.stock_codes_text);
    const datasource_bindings = form.bindings.map((b) => ({
      datasource_id: b.datasource_id.trim(),
      dependencies: normalizeBindingDependencies(b.dependencies),
    }));
    const payload = {
      name,
      description: form.description.trim(),
      datasource_bindings,
      start: form.start.trim(),
      end: form.end.trim(),
      stock_codes,
      quantiles: q,
      is_default: form.is_default,
    };
    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createEvaluationTestSet(payload);
        router.push(`/test-sets/${encodeURIComponent(created.id)}`);
      } else if (testSetId) {
        await patchEvaluationTestSet(testSetId, payload);
        router.push(`/test-sets/${encodeURIComponent(testSetId)}`);
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
      <Page gap="sm" grow={false}>
        <Alert variant="destructive">
          <AlertTitle>无法加载测试集</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link href="/test-sets" className={cn(buttonVariants({ variant: "outline" }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page gap="none">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {mode === "create" ? "新增测试集" : "编辑测试集"}
        </h1>
        <p className="text-sm text-muted-foreground">
          可配置多条数据源绑定；仅一条且未选依赖字段时，运行评价将使用因子的全部 dependencies。
        </p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
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

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">基本信息</CardTitle>
            <CardDescription>名称、说明与默认标记</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="ts-name">名称</Label>
              <Input
                id="ts-name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="例如：沪深 2023 样本"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ts-desc">说明</Label>
              <Textarea
                id="ts-desc"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={2}
                className="min-h-0 resize-y"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <div>
                <p className="text-sm font-medium">设为默认评价测试集</p>
                <p className="text-xs text-muted-foreground">
                  未指定测试集时优先使用；否则回退环境变量与数据源默认。
                </p>
              </div>
              <Switch
                checked={form.is_default}
                onCheckedChange={(v) => set({ is_default: Boolean(v) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle className="text-base">数据源绑定</CardTitle>
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
          <CardContent className="space-y-6 pt-6">
            {form.bindings.map((row, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    绑定 {index + 1}
                  </span>
                  {form.bindings.length > 1 ? (
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
                      单数据源时可全不选，表示使用因子全部依赖；多数据源时须至少选择或填写一项。
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-border/60 bg-background/50 px-3 py-3">
                      {PRESET_DEPENDENCY_FIELDS.map((field) => (
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
                                ? normalizeBindingDependencies([
                                  ...row.dependencies,
                                  field,
                                ])
                                : normalizeBindingDependencies(
                                  row.dependencies.filter((d) => d !== field),
                                );
                              updateBinding(index, { dependencies: next });
                            }}
                          />
                          <span className="font-mono text-sm">{field}</span>
                        </Label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">评价区间与参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ts-start">开始日期</Label>
                <Input
                  id="ts-start"
                  type="date"
                  value={form.start}
                  onChange={(e) => set({ start: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-end">结束日期</Label>
                <Input
                  id="ts-end"
                  type="date"
                  value={form.end}
                  onChange={(e) => set({ end: e.target.value })}
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
            <div className="space-y-2">
              <Label htmlFor="ts-quantiles">分位数</Label>
              <Input
                id="ts-quantiles"
                type="number"
                min={2}
                step={1}
                value={form.quantiles}
                onChange={(e) => set({ quantiles: e.target.value })}
                className="max-w-32 font-mono tabular-nums"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={submitting || enabledDs.length === 0}
          >
            {submitting ? "保存中…" : "保存"}
          </Button>
          <Link
            href={
              mode === "edit" && testSetId
                ? `/test-sets/${encodeURIComponent(testSetId)}`
                : "/test-sets"
            }
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex h-8 items-center justify-center px-2.5",
            )}
          >
            取消
          </Link>
        </div>
      </form>
    </Page>
  );
}
