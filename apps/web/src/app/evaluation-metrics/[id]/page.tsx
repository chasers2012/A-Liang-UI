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
    <FactorFormPageContainer
      title={<span className="font-mono">{row.name}</span>}
      description={row.description || "无描述"}
      action={
        <Link
          href={`/evaluation-metrics/${encodeURIComponent(id)}/edit`}
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
        >
          <Pencil className="size-4" />
          编辑
        </Link>
      }
    >
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
