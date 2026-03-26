"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { History } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type FactorCodeSnapshotDetailPublic,
  type FactorCodeSnapshotSummaryPublic,
  type FactorEvaluationHistoryEntry,
  getFactor,
  getFactorSnapshot,
  listFactorSnapshots,
  getFactorEvaluationHistory,
} from "@/lib/quant-agent-api";
import { FactorFormPageContainer } from "../../ui/factor-form-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PRIMARY_IC = "5";

function formatTs(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export default function FactorHistoryPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [factorName, setFactorName] = useState<string>("");
  const [snapshots, setSnapshots] = useState<FactorCodeSnapshotSummaryPublic[]>(
    [],
  );
  const [evalHistory, setEvalHistory] = useState<FactorEvaluationHistoryEntry[]>(
    [],
  );
  const [tab, setTab] = useState<"snapshots" | "evaluations">("snapshots");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FactorCodeSnapshotDetailPublic | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLists = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [detailFactor, snaps, ev] = await Promise.all([
        getFactor(id),
        listFactorSnapshots(id),
        getFactorEvaluationHistory(id),
      ]);
      setFactorName(detailFactor.name);
      setSnapshots(snaps);
      setEvalHistory(ev);
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
    if (snapshots.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !snapshots.some((s) => s.id === selectedId)) {
      setSelectedId(snapshots[0].id);
    }
  }, [snapshots, selectedId]);

  useEffect(() => {
    if (!id || !selectedId || tab !== "snapshots") {
      setDetail(null);
      return;
    }
    setDetailError(null);
    let cancelled = false;
    void (async () => {
      try {
        const d = await getFactorSnapshot(id, selectedId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, selectedId, tab]);

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

  return (
    <FactorFormPageContainer>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            历史版本
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{factorName}</span>
            {" · "}
            代码快照与评价记录来自 workspace{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              config/factor_code_snapshots.json
            </code>{" "}
            与{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              config/factor_evaluation_history.json
            </code>
            。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/factors/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            编辑源码
          </Link>
          <Link
            href="/factors"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            因子库
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border/60 pb-2">
        <Button
          type="button"
          variant={tab === "snapshots" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab("snapshots")}
        >
          <History className="size-4" />
          代码快照
        </Button>
        <Button
          type="button"
          variant={tab === "evaluations" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("evaluations")}
        >
          评价历史
        </Button>
      </div>

      {tab === "snapshots" && (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
          <Card className="min-h-48 border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/10 py-3">
              <CardTitle className="text-sm">快照列表</CardTitle>
              <CardDescription className="text-xs">
                新→旧；点击查看源码
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[min(60vh,28rem)] space-y-1 overflow-auto p-2">
              {snapshots.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  暂无快照。保存代码且源码变更时会自动生成。
                </p>
              ) : (
                snapshots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full rounded-md border px-2 py-2 text-left text-xs transition-colors",
                      selectedId === s.id
                        ? "border-primary/40 bg-muted/40"
                        : "border-transparent hover:bg-muted/30",
                    )}
                  >
                    <div className="font-mono text-[0.65rem] text-muted-foreground">
                      {formatTs(s.saved_at)}
                    </div>
                    <div className="mt-0.5 font-medium">
                      {s.kind === "manual" ? (
                        <span className="text-foreground">
                          {s.label ?? "手动"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">自动</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="min-h-48 border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/10 py-3">
              <CardTitle className="text-sm">源码（只读）</CardTitle>
              {detail && (
                <CardDescription className="text-xs">
                  {detail.meta.name} · max_window {detail.meta.max_window}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {detailError && (
                <Alert variant="destructive" className="m-4">
                  <AlertDescription>{detailError}</AlertDescription>
                </Alert>
              )}
              {detail && !detailError && (
                <pre className="max-h-[min(60vh,32rem)] overflow-auto p-4 font-mono text-xs leading-relaxed">
                  {detail.source}
                </pre>
              )}
              {!detail && !detailError && selectedId && (
                <p className="p-4 text-sm text-muted-foreground">加载源码…</p>
              )}
              {!selectedId && snapshots.length > 0 && (
                <p className="p-4 text-sm text-muted-foreground">请选择快照</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "evaluations" && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 py-3">
            <CardTitle className="text-sm">评价历史</CardTitle>
            <CardDescription className="text-xs">
              保存代码且当时存在最新评价时会自动关联快照 id；Agent 也可追加记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {evalHistory.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                暂无评价历史。配置{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">
                  factor_evaluations.json
                </code>{" "}
                并在保存代码变更后查看绑定记录。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead className="text-right">
                        Mean IC ({PRIMARY_IC}D)
                      </TableHead>
                      <TableHead>关联快照</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evalHistory.map((row) => {
                      const ic = row.mean_ic[PRIMARY_IC];
                      const err = row.error?.trim();
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatTs(row.evaluated_at)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {err ? "—" : ic != null ? ic.toFixed(4) : "—"}
                          </TableCell>
                          <TableCell className="max-w-32 truncate font-mono text-[0.65rem] text-muted-foreground">
                            {row.linked_snapshot_id ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {err ? (
                              <span className="text-destructive" title={err}>
                                失败
                              </span>
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
      )}
    </FactorFormPageContainer>
  );
}
