'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Loader2, Pencil, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import { deleteFactor } from '@/api/factors';
import { runFactorEvaluation } from '@/api/evaluation-profiles';
import type { DataSetPublic } from '@/models/data-set/dto';
import type { FactorEvaluationRowPublic, FactorSummaryPublic } from '@/models/factor/dto';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';
import {
  factorDetailStateAtomFamily,
  factorEvaluationRunningAtom,
  loadFactorDetailAtomFamily,
  refreshFactorEvalRowAtomFamily,
  refreshFactorsListAtom,
  type FactorDetailPageState,
  type FactorEvaluationRunning,
} from '@/models/factor';

import { DeleteFactorDialog } from '@/app/factors/ui/delete-factor-dialog';
import { EvaluationProfileMetricResultsPanel } from '@/app/factors/ui/evaluation-profile-metric-results';

function formatIso(iso: string): string {
  return iso.replace('T', ' ').replace('+00:00', ' UTC');
}

function hasWorkflowMetricResults(row: FactorEvaluationRowPublic): boolean {
  const r = row.results;
  if (r === null || r === undefined) return false;
  if (Array.isArray(r)) return r.length > 0;
  if (typeof r === 'object') return Object.keys(r as Record<string, unknown>).length > 0;
  return true;
}

async function runEvaluationAction(params: {
  factorId: string;
  factorName: string;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  runProfileId: string | null;
  runDataSetId: string | null;
  setEvaluationRunning: (
    v: FactorEvaluationRunning | null | ((prev: FactorEvaluationRunning | null) => FactorEvaluationRunning | null),
  ) => void;
  setS: (updater: (prev: FactorDetailPageState) => FactorDetailPageState) => void;
  refreshEvalRow: () => Promise<void>;
}) {
  const {
    factorId,
    factorName,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    runProfileId,
    runDataSetId,
    setEvaluationRunning,
    setS,
    refreshEvalRow,
  } = params;

  if (evaluatingOther) {
    setS((prev) => ({
      ...prev,
      loadError: `已有因子「${otherEvaluatingFactorName ?? ''}」正在评价，请等待完成后再试。`,
    }));
    return;
  }
  if (evaluatingThis) return;

  const profileId = runProfileId?.trim();
  if (!profileId) {
    setS((prev) => ({ ...prev, loadError: '暂无可用评价方案，请先创建评价方案后再运行评价。' }));
    return;
  }
  const dataSetId = runDataSetId?.trim();
  if (!dataSetId) {
    setS((prev) => ({ ...prev, loadError: '暂无可用数据集，请先创建数据集后再运行评价。' }));
    return;
  }

  setEvaluationRunning({ factorId, factorName });
  setS((prev) => ({ ...prev, loadError: null }));
  try {
    await runFactorEvaluation(factorId, { dataSetId, evaluationProfileId: profileId });
    await refreshEvalRow();
  } catch (e) {
    setS((prev) => ({ ...prev, loadError: e instanceof Error ? e.message : String(e) }));
  } finally {
    setEvaluationRunning((prev) => (prev?.factorId === factorId ? null : prev));
  }
}

async function deleteFactorAction(params: {
  deleteTarget: FactorSummaryPublic;
  setS: (updater: (prev: FactorDetailPageState) => FactorDetailPageState) => void;
  refreshList: () => Promise<void> | void;
  routerPush: (href: string) => void;
}) {
  const { deleteTarget, setS, refreshList, routerPush } = params;

  setS((prev) => ({ ...prev, deleting: true }));
  try {
    await deleteFactor(deleteTarget.id);
    setS((prev) => ({ ...prev, deleteTarget: null }));
    await refreshList();
    routerPush('/factors');
  } catch (e) {
    setS((prev) => ({ ...prev, loadError: e instanceof Error ? e.message : String(e) }));
  } finally {
    setS((prev) => ({ ...prev, deleting: false }));
  }
}

function FactorEvaluationRunControls(props: {
  profiles: EvaluationProfilePublic[];
  profileSelectItems: Record<string, string>;
  runProfileId: string | null;
  dataSets: DataSetPublic[];
  dataSetSelectItems: Record<string, string>;
  runDataSetId: string | null;
  evaluatingThis: boolean;
  evaluatingOther: boolean;
  otherEvaluatingFactorName: string | undefined;
  onProfileSelectValue: (raw: string) => void;
  onDataSetSelectValue: (raw: string) => void;
  onRunEvaluation: () => void;
}) {
  const {
    profiles,
    profileSelectItems,
    runProfileId,
    dataSets,
    dataSetSelectItems,
    runDataSetId,
    evaluatingThis,
    evaluatingOther,
    otherEvaluatingFactorName,
    onProfileSelectValue,
    onDataSetSelectValue,
    onRunEvaluation,
  } = props;

  const selectDisabled = evaluatingThis || evaluatingOther;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label
          htmlFor="factor-eval-profile-panel"
          className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
          评价方案
        </Label>
        <Select
          modal={false}
          items={profileSelectItems}
          value={runProfileId ?? ''}
          onValueChange={(v) => {
            if (!v) return;
            onProfileSelectValue(v);
          }}
          disabled={selectDisabled || profiles.length === 0}
        >
          <SelectTrigger id="factor-eval-profile-panel" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label
          htmlFor="factor-eval-dataset-panel"
          className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
          数据集
        </Label>
        <Select
          modal={false}
          items={dataSetSelectItems}
          value={runDataSetId ?? ''}
          onValueChange={(v) => {
            if (!v) return;
            onDataSetSelectValue(v);
          }}
          disabled={selectDisabled || dataSets.length === 0}
        >
          <SelectTrigger id="factor-eval-dataset-panel" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dataSets.map((ds) => (
              <SelectItem key={ds.id} value={ds.id}>
                {ds.name}
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
        title={evaluatingOther ? `「${otherEvaluatingFactorName ?? ''}」正在评价中` : undefined}
        onClick={onRunEvaluation}
      >
        {evaluatingThis ? <Loader2 className="size-4 animate-spin" /> : null}
        {evaluatingThis ? '评价中…' : '运行评价'}
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
        <span className={evalRow.error ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
          {evalRow.error ? '评价失败' : '评价成功'}
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
          <span className="ml-2 font-medium">{evalProfile?.name ?? evalRow.evaluation_profile_id}</span>
          {!evalProfile ? <span className="ml-1 text-xs text-muted-foreground">（方案可能已删除）</span> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">该次评价未记录评价方案，无法对齐工作流节点说明。</p>
      )}
      {!evalRow.error && evalRow.evaluation_profile_id && !hasWorkflowMetricResults(evalRow) ? (
        <p className="text-sm text-muted-foreground">
          当前评价没有工作流节点输出。若方案未配置图节点，或使用了「无（默认参数）」运行，则仅产生聚合指标且不在此展示。
        </p>
      ) : null}
      <EvaluationProfileMetricResultsPanel evalRow={evalRow} />
    </>
  );
}

function FactorDetailLoadingView(props: { factorId: string }) {
  const { factorId } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle>加载因子…</CardTitle>
        <CardDescription className="font-mono">{factorId}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </CardContent>
    </div>
  );
}

function FactorDetailNotFoundView(props: { factorId: string; loadError: string | null }) {
  const { factorId, loadError } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle>无法加载因子</CardTitle>
        <CardDescription className="font-mono">{factorId}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{loadError ?? '未知错误'}</AlertDescription>
        </Alert>
      </CardContent>
    </div>
  );
}

function FactorDetailView(props: {
  factorId: string;
  s: FactorDetailPageState;
  evaluationRunning: FactorEvaluationRunning | null;
  setEvaluationRunning: (
    v: FactorEvaluationRunning | null | ((prev: FactorEvaluationRunning | null) => FactorEvaluationRunning | null),
  ) => void;
  setS: (updater: (prev: FactorDetailPageState) => FactorDetailPageState) => void;
  refreshEvalRow: () => Promise<void>;
  refreshList: () => Promise<void> | void;
  routerPush: (href: string) => void;
}) {
  const { factorId, s, evaluationRunning, setEvaluationRunning, setS, refreshEvalRow, refreshList, routerPush } = props;

  const { detail, evalRow, loadError, profiles, dataSets, runProfileId, runDataSetId, deleteTarget, deleting } = s;
  if (!detail) return null;

  const profileSelectItems: Record<string, string> = {};
  for (const p of profiles) profileSelectItems[p.id] = p.name;

  const dataSetSelectItems: Record<string, string> = {};
  for (const ds of dataSets) dataSetSelectItems[ds.id] = ds.name;

  const evalProfile = (() => {
    const pid = evalRow?.evaluation_profile_id;
    if (!pid) return null;
    return profiles.find((p) => p.id === pid) ?? null;
  })();

  const evaluatingThis = evaluationRunning != null && evaluationRunning.factorId === factorId;
  const evaluatingOther = evaluationRunning != null && evaluationRunning.factorId !== factorId;

  const summaryForDelete: FactorSummaryPublic = {
    id: detail.id,
    name: detail.name,
    group: detail.group,
    description: detail.description,
    window: detail.window,
    dependencies: detail.dependencies,
    source_path: detail.source_path,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="min-w-0 truncate font-mono">{detail.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {detail.description.trim() !== '' ? (
              detail.description
            ) : (
              <span className="text-muted-foreground">无描述</span>
            )}
          </CardDescription>
        </div>
        <div className="flex w-full min-w-0 flex-wrap justify-end gap-2">
          <Link
            href={`/factors/${encodeURIComponent(factorId)}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
          >
            打开详情页
          </Link>
          <Link
            href={`/factors/${encodeURIComponent(factorId)}/edit`}
            className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}
          >
            <Pencil className="size-4" />
            编辑
          </Link>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setS((prev) => ({ ...prev, deleteTarget: summaryForDelete }))}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-6 overflow-auto">
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <span className="text-muted-foreground">分组</span>
              <span className="ml-2 font-medium">{detail.group || '未分组'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">窗口</span>
              <span className="ml-2 font-mono tabular-nums">{detail.window}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">依赖</span>
            <span className="font-mono text-xs">
              {detail.dependencies.length ? detail.dependencies.join(', ') : '（无）'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">源码路径</span>
            <span className="font-mono text-xs">{detail.source_path}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
            <span>created: {formatIso(detail.created_at)}</span>
            <span>updated: {formatIso(detail.updated_at)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="mb-3">
            <div className="text-sm font-medium">方案评价结果</div>
            <div className="text-xs text-muted-foreground">
              工作流节点输出（数据来自{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
                factors/data/evaluations.json
              </code>
              ）
            </div>
          </div>

          <div className="space-y-4">
            <FactorEvaluationRunControls
              profiles={profiles}
              profileSelectItems={profileSelectItems}
              runProfileId={runProfileId}
              dataSets={dataSets}
              dataSetSelectItems={dataSetSelectItems}
              runDataSetId={runDataSetId}
              evaluatingThis={evaluatingThis}
              evaluatingOther={evaluatingOther}
              otherEvaluatingFactorName={evaluatingOther ? evaluationRunning?.factorName : undefined}
              onProfileSelectValue={(v) => setS((prev) => ({ ...prev, runProfileId: v }))}
              onDataSetSelectValue={(v) => setS((prev) => ({ ...prev, runDataSetId: v }))}
              onRunEvaluation={() => {
                void runEvaluationAction({
                  factorId,
                  factorName: detail.name,
                  evaluatingThis,
                  evaluatingOther,
                  otherEvaluatingFactorName: evaluationRunning?.factorName,
                  runProfileId,
                  runDataSetId,
                  setEvaluationRunning,
                  setS,
                  refreshEvalRow,
                });
              }}
            />

            {!evalRow?.has_evaluation ? (
              <p className="text-sm text-muted-foreground">暂无评价结果。请选择评价方案后点击「运行评价」。</p>
            ) : (
              <FactorEvaluationDetails evalRow={evalRow} evalProfile={evalProfile} />
            )}
          </div>
        </div>

        <DeleteFactorDialog
          target={deleteTarget}
          deleting={deleting}
          onDismiss={() => setS((prev) => ({ ...prev, deleteTarget: null }))}
          onConfirm={() => {
            if (!deleteTarget) return;
            void deleteFactorAction({
              deleteTarget,
              setS,
              refreshList,
              routerPush,
            });
          }}
        />
      </CardContent>
    </div>
  );
}

export function FactorDetailPanel({ factorId }: { factorId: string | null }) {
  if (!factorId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>因子详情</CardTitle>
          <CardDescription>从左侧列表选择一个因子查看详情。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无选中因子</div>
        </CardContent>
      </div>
    );
  }

  return <FactorDetailPanelWithId factorId={factorId} />;
}

function FactorDetailPanelWithId({ factorId }: { factorId: string }) {
  const router = useRouter();
  const refreshList = useSetAtom(refreshFactorsListAtom);

  const evaluationRunning = useAtomValue(factorEvaluationRunningAtom);
  const setEvaluationRunning = useSetAtom(factorEvaluationRunningAtom);

  const [s, setS] = useAtom(factorDetailStateAtomFamily(factorId ?? ''));
  const loadDetail = useSetAtom(loadFactorDetailAtomFamily(factorId ?? ''));
  const refreshEvalRow = useSetAtom(refreshFactorEvalRowAtomFamily(factorId ?? ''));

  useEffectMicrotask(() => {
    void loadDetail();
  }, [factorId, loadDetail]);

  const { detail, loadError, loading } = s;

  if (loading) return <FactorDetailLoadingView factorId={factorId} />;
  if (!detail) return <FactorDetailNotFoundView factorId={factorId} loadError={loadError} />;

  return (
    <FactorDetailView
      factorId={factorId}
      s={s}
      evaluationRunning={evaluationRunning}
      setEvaluationRunning={setEvaluationRunning}
      setS={setS}
      refreshEvalRow={refreshEvalRow}
      refreshList={refreshList}
      routerPush={(href) => router.push(href)}
    />
  );
}
