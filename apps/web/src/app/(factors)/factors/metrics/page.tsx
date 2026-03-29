"use client";

import Link from "next/link";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
    <Page
      title="评价指标"
      description={
        <>
          继承 EvaluationMetric 的 Python 实现，落盘 workspace{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            evaluation_metrics/
          </code>
          。API{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            {getQuantAgentApiBase()}
          </code>
        </>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>指标列表</CardTitle>
          <CardDescription>
            在工作流画布中从「添加节点」选择具体指标（内置为
            <span className="font-mono"> builtin_mean_ic</span> 等；自定义指标为
            <span className="font-mono"> user_metric_&lt;id&gt;</span>）
          </CardDescription>
          <CardAction>
            <Link
              href="/factors/metrics/new"
              className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
            >
              <Plus className="size-4" />
              新增指标
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              暂无指标。请使用上方「新增指标」开始配置。
            </p>
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
                        href={`/factors/metrics/${encodeURIComponent(m.id)}`}
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
