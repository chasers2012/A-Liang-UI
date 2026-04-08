"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Loader2, Pencil, Trash2 } from "lucide-react";

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

import { DeleteFactorDialog } from "@/features/factors/ui/delete-factor-dialog";
import {
  EvaluationProfileMetricResultsPanel,
} from "@/features/factors/ui/evaluation-profile-metric-results";
import { Page } from "@/components/page";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function hasWorkflowMetricResults(row: FactorEvaluationRowPublic): boolean {
  const r = row.results;
  if (r === null || r === undefined) return false;
  if (Array.isArray(r)) return r.length > 0;
  if (typeof r === "object") return Object.keys(r as Record<string, unknown>).length > 0;
  return true;
}

function FactorEvaluationRunControls(props: {
  profiles: EvaluationProfilePublic[];
  profileSelectItems: Record<string, string>;
  runProfileId: string | null;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  onProfileSelectValue: (raw: string) => void;
  onRunEvaluation: () => void;
}) {
  const {
    profiles,
    profileSelectItems,
    runProfileId,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    onProfileSelectValue,
    onRunEvaluation,
  } = props;

  const selectDisabled = evaluatingThis || evaluatingOther;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label
          htmlFor="factor-eval-profile-card"
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
            id="factor-eval-profile-card"
            size="sm"
            className="w-full min-w-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">无（默认参数）</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-1.5 sm:w-auto"
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
    </div>
  );
}

function FactorEvaluationDetails(props: {
  evalRow: FactorEvaluationRowPublic;
  evalProfile: EvaluationProfilePublic | null;
}) {
  const { evalRow, evalProfile } = props;

  return (
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
            {evalProfile?.name ?? evalRow.evaluation_profile_id}
          </span>
          {!evalProfile ? (
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
          当前评价没有工作流节点输出。若方案未配置图节点，或使用了「无（默认参数）」运行，则仅产生聚合指标且不在此展示。
        </p>
      ) : null}
      <EvaluationProfileMetricResultsPanel evalRow={evalRow} />
    </>
  );
}

function FactorDetailHeaderActions(props: {
  id: string;
  onRequestDelete: () => void;
}) {
  const { id, onRequestDelete } = props;

  return (
    <div className="flex w-full min-w-0 flex-wrap justify-end gap-2">
      <Link
        href={`/factors/library/${encodeURIComponent(id)}/edit`}
        className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
      >
        <Pencil className="size-4" />
        编辑
      </Link>
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
            <dt className="text-muted-foreground">group</dt>
            <dd className="font-mono text-[0.7rem]">{detail.group}</dd>
          </div>
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

function FactorEvaluationCard(props: {
  evalRow: FactorEvaluationRowPublic | null;
  evalProfile: EvaluationProfilePublic | null;
  profiles: EvaluationProfilePublic[];
  profileSelectItems: Record<string, string>;
  runProfileId: string | null;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  onProfileSelectValue: (raw: string) => void;
  onRunEvaluation: () => void;
}) {
  const {
    evalRow,
    evalProfile,
    profiles,
    profileSelectItems,
    runProfileId,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    onProfileSelectValue,
    onRunEvaluation,
  } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>方案评价结果</CardTitle>
        <CardDescription>
          工作流节点输出（数据来自{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
            factors/data/evaluations.json
          </code>
          ）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FactorEvaluationRunControls
          profiles={profiles}
          profileSelectItems={profileSelectItems}
          runProfileId={runProfileId}
          evaluatingThis={evaluatingThis}
          evaluatingOther={evaluatingOther}
          otherEvaluatingFactorName={otherEvaluatingFactorName}
          onProfileSelectValue={onProfileSelectValue}
          onRunEvaluation={onRunEvaluation}
        />
        {!evalRow?.has_evaluation ? (
          <p className="text-sm text-muted-foreground">
            暂无评价结果。请选择评价方案后点击「运行评价」。
          </p>
        ) : (
          <FactorEvaluationDetails
            evalRow={evalRow}
            evalProfile={evalProfile}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FactorDetailLoadedView(props: {
  detail: FactorDetailPublic;
  loadError: string | null;
  evalRow: FactorEvaluationRowPublic | null;
  evalProfile: EvaluationProfilePublic | null;
  profiles: EvaluationProfilePublic[];
  profileSelectItems: Record<string, string>;
  runProfileId: string | null;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  onProfileSelectValue: (raw: string) => void;
  onRunEvaluation: () => void;
}) {
  const {
    detail,
    loadError,
    evalRow,
    evalProfile,
    profiles,
    profileSelectItems,
    runProfileId,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    onProfileSelectValue,
    onRunEvaluation,
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
        <FactorEvaluationCard
          evalRow={evalRow}
          evalProfile={evalProfile}
          profiles={profiles}
          profileSelectItems={profileSelectItems}
          runProfileId={runProfileId}
          evaluatingThis={evaluatingThis}
          evaluatingOther={evaluatingOther}
          otherEvaluatingFactorName={otherEvaluatingFactorName}
          onProfileSelectValue={onProfileSelectValue}
          onRunEvaluation={onRunEvaluation}
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
    runProfileId,
    deleteTarget,
    deleting,
  } = s;

  const profileSelectItems = useMemo(() => {
    const o: Record<string, string> = {
      __none__: "无（默认参数）",
    };
    for (const p of profiles) {
      o[p.id] = p.name;
    }
    return o;
  }, [profiles]);

  const evalProfile = useMemo(() => {
    const pid = evalRow?.evaluation_profile_id;
    if (!pid) return null;
    return profiles.find((p) => p.id === pid) ?? null;
  }, [evalRow?.evaluation_profile_id, profiles]);

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
    const profileId = runProfileId?.trim();
    if (!profileId) {
      setS((prev) => ({
        ...prev,
        loadError: "请先选择评价方案后再运行。",
      }));
      return;
    }

    setEvaluationRunning({ factorId: id, factorName: detail.name });
    setS((prev) => ({ ...prev, loadError: null }));
    try {
      await runFactorEvaluation(id, {
        dataSetId: null,
        evaluationProfileId: profileId,
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
      router.push("/factors/library");
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
      <Page>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (!detail) {
    return (
      <Page>
        <Alert variant="destructive">
          <AlertTitle>无法加载因子</AlertTitle>
          <AlertDescription>{loadError ?? "未知错误"}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  const summaryForDelete: FactorSummaryPublic = {
    id: detail.id,
    name: detail.name,
    group: detail.group,
    description: detail.description,
    max_window: detail.max_window,
    dependencies: detail.dependencies,
    source_path: detail.source_path,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };

  return (
    <Page
      title={<span className="font-mono">{detail.name}</span>}
      description={
        detail.description.trim() !== "" ? (
          detail.description
        ) : (
          <span className="text-muted-foreground">无描述</span>
        )
      }
      action={
        <FactorDetailHeaderActions
          id={id}
          onRequestDelete={() =>
            setS((prev) => ({ ...prev, deleteTarget: summaryForDelete }))
          }
        />
      }
    >
      <FactorDetailLoadedView
        detail={detail}
        loadError={loadError}
        evalRow={evalRow}
        evalProfile={evalProfile}
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
      />

      <DeleteFactorDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setS((prev) => ({ ...prev, deleteTarget: null }))}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
