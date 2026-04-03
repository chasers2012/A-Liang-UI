"use client";

import Link from "next/link";
import { useAtomValue, useSetAtom } from "jotai";
import { BarChart3, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import {
  bumpFactorsEvalOverviewRevisionAtom,
  factorEvaluationsOverviewStateAtom,
  factorsEvalOverviewRevisionAtom,
  factorsListAtom,
  loadFactorEvaluationsOverviewAtom,
} from "@/models/factor";

function formatIsoShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function formatIc(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(4);
}

export function FactorEvaluationsOverview() {
  const revision = useAtomValue(factorsEvalOverviewRevisionAtom);
  const listState = useAtomValue(factorsListAtom);
  const { data, loading, error } = useAtomValue(factorEvaluationsOverviewStateAtom);
  const loadOverview = useSetAtom(loadFactorEvaluationsOverviewAtom);
  const bumpRevision = useSetAtom(bumpFactorsEvalOverviewRevisionAtom);

  useEffectMicrotask(() => {
    void loadOverview();
  }, [revision, loadOverview]);

  const factorCount = listState.items?.length ?? 0;

  if (loading && !data) {
    return (
      <div className="flex flex-1 flex-col justify-center px-2 py-8 text-center text-sm text-muted-foreground">
        加载评价概览…
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="text-left">
        <AlertTitle>评价概览加载失败</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const { aggregate, rows } = data;
  const pp = aggregate.primary_period;

  if (factorCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <BarChart3
          className="size-10 text-muted-foreground/40"
          strokeWidth={1.25}
        />
        <p className="text-sm text-muted-foreground">
          暂无因子。创建因子后，可将评价结果写入 workspace 的{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            factors/data/evaluations.json
          </code>{" "}
          以在此查看整体评分。
        </p>
      </div>
    );
  }

  const anyEvaluated = rows.some((r) => r.has_evaluation);
  const noSuccessfulEval =
    aggregate.evaluated_count === 0 && aggregate.total_factors > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => bumpRevision()}
        >
          <RefreshCw className="size-3.5" />
          刷新评价
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            已评价 / 总数
          </p>
          <p className="mt-0.5 font-mono text-lg tabular-nums tracking-tight">
            {aggregate.evaluated_count}
            <span className="text-muted-foreground"> / </span>
            {aggregate.total_factors}
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            平均 Mean IC ({pp}D)
          </p>
          <p className="mt-0.5 font-mono text-lg tabular-nums tracking-tight">
            {formatIc(aggregate.mean_ic_primary_avg)}
          </p>
        </div>
        <div className="col-span-2 rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5 sm:col-span-1">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            待成功评价
          </p>
          <p className="mt-0.5 font-mono text-lg tabular-nums tracking-tight">
            {aggregate.unevaluated_count}
          </p>
        </div>
      </div>

      {!anyEvaluated && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          当前没有任何评价记录。请通过 API/Agent 运行评价或写入{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
            factors/data/evaluations.json
          </code>
          ，刷新本页即可看到汇总。
        </p>
      )}

      {anyEvaluated && noSuccessfulEval && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          已有评价记录但均无成功结果（可能存在 error 字段）。请检查各因子条目或重新运行评价。
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>因子</TableHead>
                <TableHead className="text-right">Mean IC ({pp}D)</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Spread ({pp}D)
                </TableHead>
                <TableHead className="hidden sm:table-cell">评价时间</TableHead>
                <TableHead className="text-right">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                let status: string;
                if (!r.has_evaluation) {
                  status = "未评价";
                } else if (r.error) {
                  status = "失败";
                } else {
                  status = "成功";
                }
                return (
                  <TableRow key={r.factor_id}>
                    <TableCell className="max-w-40 truncate font-mono text-xs font-medium">
                      <Link
                        href={`/factors/library/${encodeURIComponent(r.factor_id)}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </TableCell>

                    <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                      {formatIsoShort(r.evaluated_at ?? null)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-right text-xs">
                      <span
                        className={
                          status === "成功"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : status === "失败"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {status}
                      </span>
                      {r.error ? (
                        <span
                          className="mt-0.5 block max-w-32 truncate text-[0.65rem] text-muted-foreground sm:max-w-none"
                          title={r.error}
                        >
                          {r.error}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
