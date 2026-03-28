"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
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
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { cn } from "@/lib/utils";
import {
  deleteFactor,
  runFactorEvaluation,
  type FactorEvaluationRowPublic,
  type FactorSummaryPublic,
} from "@/lib/quant-agent-api";
import type { EvaluationProfilePublic } from "@/models/evaluation-profile/dto";
import type { FactorDetailPublic } from "@/models/factor/dto";
import {
  factorDetailStateAtomFamily,
  factorEvaluationRunningAtom,
  loadFactorDetailAtomFamily,
  refreshFactorEvalRowAtomFamily,
} from "@/models/factor";

import { DeleteFactorDialog } from "../ui/delete-factor-dialog";
import {
  EvaluationProfileMetricResultsPanel,
  type MetricMetaEntry,
} from "../ui/evaluation-profile-metric-results";
import { FactorFormPageContainer } from "../ui/factor-form-page";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function hasWorkflowMetricResults(row: FactorEvaluationRowPublic): boolean {
  const m = row.metric_results;
  if (!m || typeof m !== "object") return false;
  return Object.keys(m).length > 0;
}

function FactorDetailHeaderActions(props: {
  id: string;
  profiles: EvaluationProfilePublic[];
  profileSelectItems: Record<string, string>;
  runProfileId: string | null;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  onProfileSelectValue: (raw: string) => void;
  onRunEvaluation: () => void;
  onRequestDelete: () => void;
}) {
  const {
    id,
    profiles,
    profileSelectItems,
    runProfileId,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    onProfileSelectValue,
    onRunEvaluation,
    onRequestDelete,
  } = props;

  const selectDisabled = evaluatingThis || evaluatingOther;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
        <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-56">
          <Label
            htmlFor="factor-eval-profile"
            className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            评价方案
          </Label>
          <Select
            modal={false}
            items={profileSelectItems}
            value={runProfileId ?? "__none__"}
            onValueChange={(v) => {
              if (!v) return;
              onProfileSelectValue(v);
            }}
            disabled={selectDisabled}
          >
            <SelectTrigger
              id="factor-eval-profile"
              size="sm"
              className="w-full min-w-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无（默认参数）</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.is_default ? `${p.name}（默认）` : p.name}
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
            disabled={selectDisabled}
            title={
              evaluatingOther
                ? `「${otherEvaluatingFactorName ?? ""}」正在评价中`
                : undefined
            }
            onClick={onRunEvaluation}
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
            onClick={onRequestDelete}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
    </div>
  );
}

function FactorMetadataCard(props: { detail: FactorDetailPublic }) {
  const { detail } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>元数据</CardTitle>
        <CardDescription>来自 registry 与源码路径</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
  );
}

function FactorEvaluationSnapshotCard(props: {
  id: string;
  evalRow: FactorEvaluationRowPublic | null;
  evalProfileForSnapshot: EvaluationProfilePublic | null;
  metricMetaById: Record<string, MetricMetaEntry>;
}) {
  const { id, evalRow, evalProfileForSnapshot, metricMetaById } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>方案评价结果</CardTitle>
        <CardDescription>
          工作流节点输出（快照来自{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
            config/factor_evaluations.json
          </code>
          ）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!evalRow?.has_evaluation ? (
          <p className="text-sm text-muted-foreground">
            暂无评价快照。请选择评价方案后点击「运行评价」，或查看
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
              {evalRow.evaluated_at ? (
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatIso(evalRow.evaluated_at)}
                </span>
              ) : null}
            </div>
            {evalRow.error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {evalRow.error}
              </p>
            ) : null}
            {evalRow.evaluation_profile_id ? (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">评价方案</span>
                <span className="ml-2 font-medium">
                  {evalProfileForSnapshot?.name ??
                    evalRow.evaluation_profile_id}
                </span>
                {!evalProfileForSnapshot ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    （方案可能已删除）
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                该次评价未记录评价方案，无法对齐工作流节点说明。
              </p>
            )}
            {!evalRow.error &&
              evalRow.evaluation_profile_id &&
              !hasWorkflowMetricResults(evalRow) ? (
              <p className="text-sm text-muted-foreground">
                当前快照没有工作流节点输出。若方案未配置图节点，或使用了「无（默认参数）」运行，则仅产生聚合指标且不在此展示。
              </p>
            ) : null}
            <EvaluationProfileMetricResultsPanel
              metricResults={evalRow.metric_results ?? {}}
              profile={evalProfileForSnapshot}
              metricMetaById={metricMetaById}
            />
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
  );
}

function FactorDetailLoadedView(props: {
  id: string;
  detail: FactorDetailPublic;
  loadError: string | null;
  evalRow: FactorEvaluationRowPublic | null;
  evalProfileForSnapshot: EvaluationProfilePublic | null;
  metricMetaById: Record<string, MetricMetaEntry>;
}) {
  const {
    id,
    detail,
    loadError,
    evalRow,
    evalProfileForSnapshot,
    metricMetaById,
  } = props;

  return (
    <>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <FactorMetadataCard detail={detail} />
        <FactorEvaluationSnapshotCard
          id={id}
          evalRow={evalRow}
          evalProfileForSnapshot={evalProfileForSnapshot}
          metricMetaById={metricMetaById}
        />
      </div>
    </>
  );
}

export default function FactorDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const router = useRouter();
  const evaluationRunning = useAtomValue(factorEvaluationRunningAtom);
  const setEvaluationRunning = useSetAtom(factorEvaluationRunningAtom);

  const [s, setS] = useAtom(factorDetailStateAtomFamily(id));
  const loadDetail = useSetAtom(loadFactorDetailAtomFamily(id));
  const refreshEvalRow = useSetAtom(refreshFactorEvalRowAtomFamily(id));

  useEffectMicrotask(() => {
    void loadDetail();
  }, [id, loadDetail]);

  const {
    detail,
    evalRow,
    loadError,
    loading,
    profiles,
    evaluationMetrics,
    runProfileId,
    deleteTarget,
    deleting,
  } = s;

  const profileSelectItems = useMemo(() => {
    const o: Record<string, string> = {
      __none__: "无（默认参数）",
    };
    for (const p of profiles) {
      o[p.id] = p.is_default ? `${p.name}（默认）` : p.name;
    }
    return o;
  }, [profiles]);

  const evalProfileForSnapshot = useMemo(() => {
    const pid = evalRow?.evaluation_profile_id;
    if (!pid) return null;
    return profiles.find((p) => p.id === pid) ?? null;
  }, [evalRow?.evaluation_profile_id, profiles]);

  const metricMetaById = useMemo(() => {
    const o: Record<string, MetricMetaEntry> = {};
    for (const m of evaluationMetrics) {
      o[m.id] = { name: m.name };
    }
    return o;
  }, [evaluationMetrics]);

  const evaluatingThis =
    evaluationRunning != null && evaluationRunning.factorId === id;
  const evaluatingOther =
    evaluationRunning != null && evaluationRunning.factorId !== id;

  const handleRunEvaluation = async () => {
    if (!id || !detail) return;
    if (evaluatingOther) {
      setS((prev) => ({
        ...prev,
        loadError: `已有因子「${evaluationRunning.factorName}」正在评价，请等待完成后再试。`,
      }));
      return;
    }
    if (evaluatingThis) return;

    setEvaluationRunning({ factorId: id, factorName: detail.name });
    setS((prev) => ({ ...prev, loadError: null }));
    try {
      await runFactorEvaluation(id, {
        testSetId: null,
        evaluationProfileId: runProfileId,
      });
      await refreshEvalRow();
    } catch (e) {
      setS((prev) => ({
        ...prev,
        loadError: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setEvaluationRunning((prev) =>
        prev?.factorId === id ? null : prev,
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setS((prev) => ({ ...prev, deleting: true }));
    try {
      await deleteFactor(deleteTarget.id);
      setS((prev) => ({ ...prev, deleteTarget: null }));
      router.push("/factors");
    } catch (e) {
      setS((prev) => ({
        ...prev,
        loadError: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setS((prev) => ({ ...prev, deleting: false }));
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

  if (!detail) {
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

  return (
    <FactorFormPageContainer
      title={<span className="font-mono">{detail.name}</span>}
      description={
        <>
          {detail.group}
          {detail.group_label && detail.group_label !== detail.group
            ? ` · ${detail.group_label}`
            : null}
        </>
      }
      action={
        <FactorDetailHeaderActions
          id={id}
          profiles={profiles}
          profileSelectItems={profileSelectItems}
          runProfileId={runProfileId}
          evaluatingThis={evaluatingThis}
          evaluatingOther={evaluatingOther}
          otherEvaluatingFactorName={
            evaluatingOther ? evaluationRunning?.factorName : undefined
          }
          onProfileSelectValue={(v) =>
            setS((prev) => ({
              ...prev,
              runProfileId: v === "__none__" ? null : v,
            }))
          }
          onRunEvaluation={() => void handleRunEvaluation()}
          onRequestDelete={() =>
            setS((prev) => ({ ...prev, deleteTarget: summaryForDelete }))
          }
        />
      }
    >
      <FactorDetailLoadedView
        id={id}
        detail={detail}
        loadError={loadError}
        evalRow={evalRow}
        evalProfileForSnapshot={evalProfileForSnapshot}
        metricMetaById={metricMetaById}
      />

      <DeleteFactorDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setS((prev) => ({ ...prev, deleteTarget: null }))}
        onConfirm={confirmDelete}
      />
    </FactorFormPageContainer>
  );
}
