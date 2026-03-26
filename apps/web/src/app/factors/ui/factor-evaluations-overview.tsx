"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import {
  type FactorEvaluationsSummaryPublic,
  getFactorEvaluationsSummary,
} from "@/lib/quant-agent-api";

function formatIsoShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function formatIc(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(4);
}

type Props = {
  refreshKey: number;
  factorCount: number;
  onRefresh?: () => void;
};

export function FactorEvaluationsOverview({
  refreshKey,
  factorCount,
  onRefresh,
}: Props) {
  const [data, setData] = useState<FactorEvaluationsSummaryPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await getFactorEvaluationsSummary());
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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
          暂无因子。创建因子后，可将评价快照写入 workspace 的{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            config/factor_evaluations.json
          </code>{" "}
          以在此查看整体评分。
        </p>
      </div>
    );
  }

  const anySnapshot = rows.some((r) => r.has_evaluation);
  const noSuccessfulEval =
    aggregate.evaluated_count === 0 && aggregate.total_factors > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {onRefresh ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onRefresh()}
          >
            <RefreshCw className="size-3.5" />
            刷新评价
          </Button>
        </div>
      ) : null}
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

      {!anySnapshot && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          当前没有任何评价快照。请通过 CLI/Agent 将结果写入{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
            config/factor_evaluations.json
          </code>
          （与{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
            factors.json
          </code>{" "}
          同目录），刷新本页即可看到汇总。
        </p>
      )}

      {anySnapshot && noSuccessfulEval && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          已有快照但均无成功结果（可能存在 error 字段）。请检查各因子条目或重新生成评价。
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
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
              const ic = r.mean_ic[pp];
              const spread = r.mean_return_spread?.[pp];
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
                      href={`/factors/${encodeURIComponent(r.factor_id)}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.error ? "—" : formatIc(ic)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs tabular-nums md:table-cell">
                    {r.error ? "—" : formatIc(spread)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {formatIsoShort(r.evaluated_at ?? null)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
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
  );
}
