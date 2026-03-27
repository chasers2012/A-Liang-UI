"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { Pencil } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { METRIC_VIZ_MODE_ITEMS } from "@/lib/metric-visualization-form";
import { cn } from "@/lib/utils";
import {
  evaluationMetricDetailAtomFamily,
  loadEvaluationMetricDetailAtomFamily,
} from "@/models/evaluation-metric/list-detail.atom";

import { FactorFormPageContainer } from "@/app/factors/ui/factor-form-page";

export default function EvaluationMetricDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const { row, error } = useAtomValue(evaluationMetricDetailAtomFamily(id));
  const load = useSetAtom(loadEvaluationMetricDetailAtomFamily(id));

  useEffectMicrotask(() => {
    void load();
  }, [id, load]);

  if (!id) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  if (error || !row) {
    return (
      <FactorFormPageContainer>
        <Alert variant={error ? "destructive" : "default"}>
          <AlertTitle>{error ? "加载失败" : "加载中…"}</AlertTitle>
          {error ? <AlertDescription>{error}</AlertDescription> : null}
        </Alert>
      </FactorFormPageContainer>
    );
  }

  return (
    <FactorFormPageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="font-mono">{row.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{row.description || "无描述"}</p>
        </div>
        <Link
          href={`/evaluation-metrics/${encodeURIComponent(id)}/edit`}
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5 self-start")}
        >
          <Pencil className="size-4" />
          编辑
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>元数据</CardTitle>
          <CardDescription className="font-mono text-xs">{row.source_path}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>id: {row.id}</p>
          <p>创建: {row.created_at}</p>
          <p>更新: {row.updated_at}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>结果可视化</CardTitle>
          <CardDescription>
            因子详情页中工作流「自定义指标」节点的展示方式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {row.visualization ? (
            <>
              <p>
                <span className="text-foreground">模式：</span>
                {METRIC_VIZ_MODE_ITEMS.find((x) => x.value === row.visualization?.mode)
                  ?.label ?? row.visualization.mode}
              </p>
              <p>
                <span className="text-foreground">数字键显示为「N 日」：</span>
                {row.visualization.period_day_keys ? "是" : "否"}
              </p>
            </>
          ) : (
            <p>未在注册表中保存配置；创建时若未指定，可能来自源码中的 VISUALIZATION。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>源码</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[min(60vh,32rem)] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {row.source}
          </pre>
        </CardContent>
      </Card>
    </FactorFormPageContainer>
  );
}
