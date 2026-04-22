import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';
import type { FactorEvaluationRowPublic } from '@/models/factor/dto';
import { factorDetailEvalRowAtom } from '@/models/factor';
import { useAtomValue } from 'jotai';

import { EvaluationProfileMetricResultsPanel } from './evaluation-profile-metric-results';
import { evaluationProfilesListItemsAtom } from '@/models/evaluation-profile/list-detail.atom';

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

export function FactorEvaluationResult(props: { factorId: string }) {
  const { factorId } = props;
  void factorId;
  const evalRow = useAtomValue(factorDetailEvalRowAtom);
  const profiles = useAtomValue(evaluationProfilesListItemsAtom);

  if (!evalRow?.has_evaluation) {
    return <p className="text-sm text-muted-foreground">暂无评价结果。请选择评价方案后点击「运行评价」。</p>;
  }

  const evalProfile: EvaluationProfilePublic | null = (() => {
    const pid = evalRow.evaluation_profile_id;
    if (!pid) return null;
    return profiles.find((p) => p.id === pid) ?? null;
  })();

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
