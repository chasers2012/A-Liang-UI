"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
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
import {
  type FactorEvaluationHistoryEntry,
  getFactor,
  getFactorEvaluationsSummary,
  getFactorEvaluationHistory,
} from "@/lib/quant-agent-api";
import {
  formatEvaluationWindow,
  formatStockCount,
} from "@/lib/factor-evaluation-display";
import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTs(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

function formatMetric(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toFixed(4);
}

function sortedPeriodKeys(rows: FactorEvaluationHistoryEntry[]): string[] {
  const s = new Set<string>();
  for (const row of rows) {
    Object.keys(row.mean_ic ?? {}).forEach((k) => s.add(k));
    Object.keys(row.mean_return_spread ?? {}).forEach((k) => s.add(k));
  }
  return [...s].sort((a, b) => Number(a) - Number(b));
}

function FactorEvaluationsPanel(props: {
  periodKeys: string[];
  periodItemMap: Record<string, string>;
  primaryPeriod: string;
  selectedPeriod: string;
  onPeriodChange: (v: string) => void;
  evalHistory: FactorEvaluationHistoryEntry[];
  displayPeriod: string;
}) {
  const {
    periodKeys,
    periodItemMap,
    primaryPeriod,
    selectedPeriod,
    onPeriodChange,
    evalHistory,
    displayPeriod,
  } = props;

  return (
    <Card size="sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>评价历史</CardTitle>
            <CardDescription className="text-xs">
              记录来自 workspace{" "}
              <code className="rounded bg-muted px-1 font-mono text-[0.65rem]">
                factors/data/evaluation_history.json
              </code>
              。
            </CardDescription>
          </div>
          {periodKeys.length > 0 ? (
            <div className="flex flex-col gap-1.5 sm:items-end">
              <Label
                htmlFor="eval-period"
                className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
              >
                展示周期（主周期 {primaryPeriod}D）
              </Label>
              <Select
                modal={false}
                items={periodItemMap}
                value={selectedPeriod}
                onValueChange={(v) => {
                  if (v) onPeriodChange(v);
                }}
              >
                <SelectTrigger id="eval-period" size="sm" className="w-34">
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
      </CardHeader>
      <CardContent className="p-0">
        {evalHistory.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            暂无评价历史。运行评价后在此查看记录。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead className="min-w-36">样本区间</TableHead>
                  <TableHead className="text-right">股票数</TableHead>
                  <TableHead className="text-right">
                    Mean IC ({displayPeriod}D)
                  </TableHead>
                  <TableHead className="text-right">
                    Return spread ({displayPeriod}D)
                  </TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evalHistory.map((row) => {
                  const ic = row.mean_ic[displayPeriod];
                  const spread = row.mean_return_spread?.[displayPeriod];
                  const err = row.error?.trim();
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatTs(row.evaluated_at)}
                      </TableCell>
                      <TableCell className="max-w-56 font-mono text-[0.65rem] leading-snug break-all text-muted-foreground">
                        {formatEvaluationWindow(row.window)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatStockCount(row.stock_count)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {err ? "—" : formatMetric(ic)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {err ? "—" : formatMetric(spread)}
                      </TableCell>
                      <TableCell className="max-w-[min(24rem,40vw)] text-xs">
                        {err ? (
                          <div className="space-y-1">
                            <span className="text-destructive">失败</span>
                            <p
                              className="whitespace-pre-wrap wrap-break-word font-mono text-[0.65rem] leading-snug text-destructive/90"
                              title={err}
                            >
                              {err}
                            </p>
                          </div>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            成功
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FactorHistoryPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [factorName, setFactorName] = useState<string>("");
  const [evalHistory, setEvalHistory] = useState<FactorEvaluationHistoryEntry[]>(
    [],
  );
  const [primaryPeriod, setPrimaryPeriod] = useState("5");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const periodKeys = useMemo(
    () => sortedPeriodKeys(evalHistory),
    [evalHistory],
  );

  const periodItemMap = useMemo(() => {
    const o: Record<string, string> = {};
    for (const k of periodKeys) o[k] = `${k} 日`;
    return o;
  }, [periodKeys]);

  const loadLists = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [detailFactor, ev, summary] = await Promise.all([
        getFactor(id),
        getFactorEvaluationHistory(id),
        getFactorEvaluationsSummary(),
      ]);
      setFactorName(detailFactor.name);
      setEvalHistory(ev);
      setPrimaryPeriod(summary.aggregate.primary_period);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (periodKeys.length === 0) {
      setSelectedPeriod("");
      return;
    }
    setSelectedPeriod((prev) => {
      if (prev && periodKeys.includes(prev)) return prev;
      if (periodKeys.includes(primaryPeriod)) return primaryPeriod;
      return periodKeys[0] ?? "";
    });
  }, [periodKeys, primaryPeriod]);

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

  if (loadError) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  const displayPeriod = selectedPeriod || primaryPeriod;

  return (
    <FactorFormPageContainer
      title="评价历史"
      description={
        <>
          <span className="font-mono text-xs">{factorName}</span>
          {" · "}
          数据来自 workspace{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            factors/data/evaluation_history.json
          </code>
          。
        </>
      }
      action={
        <>
          <Link
            href={`/factors/library/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            编辑源码
          </Link>
          <Link
            href="/factors/library"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            因子库
          </Link>
        </>
      }
    >
      <FactorEvaluationsPanel
        periodKeys={periodKeys}
        periodItemMap={periodItemMap}
        primaryPeriod={primaryPeriod}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        evalHistory={evalHistory}
        displayPeriod={displayPeriod}
      />
    </FactorFormPageContainer>
  );
}
