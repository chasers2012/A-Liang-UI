"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { Pencil } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { CodeJar } from "@/components/ui/code-jar";
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

import { Page } from "@/components/page";

export default function NodeDetailPage() {
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
      <Page>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </Page>
    );
  }

  if (error || !row) {
    return (
      <Page>
        <Alert variant={error ? "destructive" : "default"}>
          <AlertTitle>{error ? "加载失败" : "加载中…"}</AlertTitle>
          {error ? <AlertDescription>{error}</AlertDescription> : null}
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title={<span className="font-mono">{row.name}</span>}
      description={row.description || "无描述"}
      action={
        <Link
          href={`/nodes/${encodeURIComponent(id)}/edit`}
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
          <p>type: {row.type || "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>源码</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeJar
            id={`node-detail-source-${id}`}
            readOnly
            value={row.source}
            className="min-h-0 max-h-[min(60vh,32rem)] sm:min-h-0"
          />
        </CardContent>
      </Card>
    </Page>
  );
}
