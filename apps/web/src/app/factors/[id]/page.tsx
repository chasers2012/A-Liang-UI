"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronRight, History, Loader2, Pencil, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { factorEvaluationRunningAtom } from "@/lib/factor-evaluation-atoms";
import {
  formatEvaluationWindow,
  formatStockCount,
} from "@/lib/factor-evaluation-display";
import {
  deleteFactor,
  getFactor,
  getFactorEvaluationsSummary,
  listEvaluationTestSets,
  runFactorEvaluation,
  type EvaluationTestSetPublic,
  type FactorDetailPublic,
  type FactorEvaluationRowPublic,
  type FactorSummaryPublic,
} from "@/lib/quant-agent-api";

import { DeleteFactorDialog } from "../ui/delete-factor-dialog";
import { FactorFormPageContainer } from "../ui/factor-form-page";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function formatIc(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toFixed(4);
}

export default function FactorDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const router = useRouter();
  const evaluationRunning = useAtomValue(factorEvaluationRunningAtom);
  const setEvaluationRunning = useSetAtom(factorEvaluationRunningAtom);

  const [detail, setDetail] = useState<FactorDetailPublic | null>(null);
  const [evalRow, setEvalRow] = useState<FactorEvaluationRowPublic | null>(null);
  const [primaryPeriod, setPrimaryPeriod] = useState("5");
  const [displayPeriod, setDisplayPeriod] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState<FactorSummaryPublic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [testSets, setTestSets] = useState<EvaluationTestSetPublic[]>([]);
  /** null = 自动（服务端：默认测试集 → 环境变量） */
  const [runTestSetId, setRunTestSetId] = useState<string | null>(null);

  const periodKeys = useMemo(() => {
    const ic = evalRow?.mean_ic;
    if (!ic || Object.keys(ic).length === 0) return [];
    return Object.keys(ic).sort((a, b) => Number(a) - Number(b));
  }, [evalRow?.mean_ic]);

  const periodItemMap = useMemo(() => {
    const o: Record<string, string> = {};
    for (const k of periodKeys) o[k] = `${k} 日`;
    return o;
  }, [periodKeys]);

  const testSetSelectItems = useMemo(() => {
    const o: Record<string, string> = {
      __auto__: "自动（默认测试集或环境变量）",
    };
    for (const t of testSets) {
      o[t.id] = t.name;
    }
    return o;
  }, [testSets]);

  useEffect(() => {
    if (periodKeys.length === 0) {
      setDisplayPeriod("");
      return;
    }
    setDisplayPeriod((prev) => {
      if (prev && periodKeys.includes(prev)) return prev;
      if (periodKeys.includes(primaryPeriod)) return primaryPeriod;
      return periodKeys[0] ?? "";
    });
  }, [periodKeys, primaryPeriod]);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError("无效的因子 id");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const [d, summary, ts] = await Promise.all([
        getFactor(id),
        getFactorEvaluationsSummary(),
        listEvaluationTestSets(),
      ]);
      setDetail(d);
      setPrimaryPeriod(summary.aggregate.primary_period);
      setEvalRow(summary.rows.find((r) => r.factor_id === id) ?? null);
      setTestSets(ts);
      setRunTestSetId((prev) => {
        if (prev && ts.some((x) => x.id === prev)) return prev;
        const def = ts.find((t) => t.is_default);
        return def ? def.id : null;
      });
    } catch (e) {
      setDetail(null);
      setEvalRow(null);
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshEvalRow = useCallback(async () => {
    if (!id) return;
    const summary = await getFactorEvaluationsSummary();
    setPrimaryPeriod(summary.aggregate.primary_period);
    setEvalRow(summary.rows.find((r) => r.factor_id === id) ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const evaluatingThis =
    evaluationRunning != null && evaluationRunning.factorId === id;
  const evaluatingOther =
    evaluationRunning != null && evaluationRunning.factorId !== id;

  const handleRunEvaluation = async () => {
    if (!id || !detail) return;
    if (evaluatingOther) {
      setLoadError(
        `已有因子「${evaluationRunning.factorName}」正在评价，请等待完成后再试。`,
      );
      return;
    }
    if (evaluatingThis) return;

    setEvaluationRunning({ factorId: id, factorName: detail.name });
    setLoadError(null);
    try {
      await runFactorEvaluation(id, { testSetId: runTestSetId });
      await refreshEvalRow();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvaluationRunning((prev) =>
        prev?.factorId === id ? null : prev,
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteOpen) return;
    setDeleting(true);
    try {
      await deleteFactor(deleteOpen.id);
      setDeleteOpen(null);
      router.push("/factors");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  if (!id) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  if (loading) {
    return (
      <FactorFormPageContainer>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </FactorFormPageContainer>
    );
  }

  if (loadError || !detail) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>无法加载因子</AlertTitle>
          <AlertDescription>{loadError ?? "未知错误"}</AlertDescription>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  const summaryForDelete: FactorSummaryPublic = {
    id: detail.id,
    name: detail.name,
    group: detail.group,
    group_label: detail.group_label,
    description: detail.description,
    max_window: detail.max_window,
    dependencies: detail.dependencies,
    source_path: detail.source_path,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };

  const pp = displayPeriod || primaryPeriod;
  const icPrimary = evalRow?.mean_ic?.[pp];
  const spreadPrimary = evalRow?.mean_return_spread?.[pp];

  return (
    <FactorFormPageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="font-mono">{detail.name}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {detail.group}
            {detail.group_label && detail.group_label !== detail.group
              ? ` · ${detail.group_label}`
              : null}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-[14rem]">
            <Label
              htmlFor="factor-eval-test-set"
              className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
            >
              评价测试集
            </Label>
            <Select
              modal={false}
              items={testSetSelectItems}
              value={runTestSetId ?? "__auto__"}
              onValueChange={(v) => {
                if (!v) return;
                setRunTestSetId(v === "__auto__" ? null : v);
              }}
              disabled={evaluatingThis || evaluatingOther}
            >
              <SelectTrigger
                id="factor-eval-test-set"
                size="sm"
                className="w-full min-w-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">
                  自动（默认测试集或环境变量）
                </SelectItem>
                {testSets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link
            href={`/factors/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
          >
            <Pencil className="size-4" />
            编辑
          </Link>
          <Link
            href={`/factors/${encodeURIComponent(id)}/history`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <History className="size-4" />
            历史
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={evaluatingThis || evaluatingOther}
            title={
              evaluatingOther
                ? `「${evaluationRunning.factorName}」正在评价中`
                : undefined
            }
            onClick={() => void handleRunEvaluation()}
          >
            {evaluatingThis ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {evaluatingThis ? "评价中…" : "运行评价"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setDeleteOpen(summaryForDelete)}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
          </div>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">元数据</CardTitle>
            <CardDescription>来自 registry 与源码路径</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            {detail.description ? (
              <p className="leading-relaxed text-muted-foreground">
                {detail.description}
              </p>
            ) : (
              <p className="text-muted-foreground/70">无描述</p>
            )}
            <dl className="grid gap-2 text-xs">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">max_window</dt>
                <dd className="font-mono tabular-nums">{detail.max_window}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">dependencies</dt>
                <dd className="font-mono text-[0.7rem] leading-relaxed break-all">
                  {detail.dependencies.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">source_path</dt>
                <dd className="break-all font-mono text-[0.7rem]">
                  {detail.source_path}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">创建</dt>
                <dd className="font-mono tabular-nums text-[0.7rem]">
                  {formatIso(detail.created_at)}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">更新</dt>
                <dd className="font-mono tabular-nums text-[0.7rem]">
                  {formatIso(detail.updated_at)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">最新评价</CardTitle>
            <CardDescription>
              来自{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
                config/factor_evaluations.json
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!evalRow?.has_evaluation ? (
              <p className="text-sm text-muted-foreground">
                暂无评价快照。可通过 CLI/Agent 写入评价，或在保存代码变更后查看与快照绑定的
                <Link
                  href={`/factors/${encodeURIComponent(id)}/history`}
                  className="mx-1 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  评价历史
                </Link>
                。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={
                      evalRow.error
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {evalRow.error ? "评价失败" : "评价成功"}
                  </span>
                  {evalRow.evaluated_at && (
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {formatIso(evalRow.evaluated_at)}
                    </span>
                  )}
                </div>
                {evalRow.error ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {evalRow.error}
                  </p>
                ) : null}
                <dl className="grid gap-2 border-t border-border/60 pt-4 text-xs">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <dt className="text-muted-foreground">样本区间</dt>
                    <dd className="break-all font-mono text-[0.7rem] leading-relaxed tabular-nums">
                      {formatEvaluationWindow(evalRow.window)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <dt className="text-muted-foreground">股票数量</dt>
                    <dd className="font-mono tabular-nums">
                      {formatStockCount(evalRow.stock_count)}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mean IC（{pp}D）
                    </p>
                    <p className="font-mono text-lg tabular-nums">
                      {formatIc(icPrimary)}
                    </p>
                  </div>
                  {periodKeys.length > 1 ? (
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="factor-detail-period"
                        className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        展示周期（主周期 {primaryPeriod}D）
                      </Label>
                      <Select
                        modal={false}
                        items={periodItemMap}
                        value={displayPeriod}
                        onValueChange={(v) => v && setDisplayPeriod(v)}
                      >
                        <SelectTrigger
                          id="factor-detail-period"
                          size="sm"
                          className="w-[8.5rem]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {periodKeys.map((k) => (
                            <SelectItem key={k} value={k}>
                              {k} 日
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
                {evalRow.mean_return_spread &&
                Object.keys(evalRow.mean_return_spread).length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Return spread（{pp}D）
                    </p>
                    <p className="font-mono text-lg tabular-nums">
                      {formatIc(spreadPrimary)}
                    </p>
                    <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">
                      各周期 spread
                    </p>
                    <ul className="flex flex-wrap gap-2 font-mono text-xs tabular-nums">
                      {Object.entries(evalRow.mean_return_spread)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([k, v]) => (
                          <li
                            key={k}
                            className="rounded-md border border-border/80 bg-muted/20 px-2 py-1"
                          >
                            {k}D: {formatIc(v)}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                {evalRow.mean_ic &&
                Object.keys(evalRow.mean_ic).length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      各周期 Mean IC
                    </p>
                    <ul className="flex flex-wrap gap-2 font-mono text-xs tabular-nums">
                      {Object.entries(evalRow.mean_ic)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([k, v]) => (
                          <li
                            key={k}
                            className="rounded-md border border-border/80 bg-muted/20 px-2 py-1"
                          >
                            {k}D: {formatIc(v)}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                <Link
                  href={`/factors/${encodeURIComponent(id)}/history`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex gap-1",
                  )}
                >
                  查看评价历史与代码快照
                  <ChevronRight className="size-4" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <DeleteFactorDialog
        target={deleteOpen}
        deleting={deleting}
        onDismiss={() => setDeleteOpen(null)}
        onConfirm={confirmDelete}
      />
    </FactorFormPageContainer>
  );
}
