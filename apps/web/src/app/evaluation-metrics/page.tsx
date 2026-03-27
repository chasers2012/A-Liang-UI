"use client";

import Link from "next/link";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Page } from "@/components/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { getQuantAgentApiBase } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import {
  evaluationMetricsListAtom,
  refreshEvaluationMetricsListAtom,
} from "@/models/evaluation-metric/list-detail.atom";

export default function EvaluationMetricsPage() {
  const { items, error } = useAtomValue(evaluationMetricsListAtom);
  const refresh = useSetAtom(refreshEvaluationMetricsListAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            评价指标
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            继承 EvaluationMetric 的 Python 实现，落盘 workspace{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              evaluation_metrics/
            </code>
            。API{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>
          </p>
        </div>
        <Link
          href="/evaluation-metrics/new"
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5 self-start")}
        >
          <Plus className="size-4" />
          新增指标
        </Link>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <CardTitle className="text-base">指标列表</CardTitle>
          <CardDescription>
            在工作流中使用节点类型 <span className="font-mono">user_metric</span>{" "}
            并设置 <span className="font-mono">params.metric_id</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">暂无指标</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden sm:table-cell">描述</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.name}</TableCell>
                    <TableCell className="hidden max-w-md truncate text-muted-foreground sm:table-cell">
                      {m.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/evaluation-metrics/${encodeURIComponent(m.id)}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        详情
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
