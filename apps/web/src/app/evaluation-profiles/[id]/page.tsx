"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEvaluationProfile, type EvaluationProfilePublic } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";

import { FactorFormPageContainer } from "@/app/factors/ui/factor-form-page";

export default function EvaluationProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const [row, setRow] = useState<EvaluationProfilePublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setRow(await getEvaluationProfile(id));
    } catch (e) {
      setRow(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

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
            {row.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.description || "无描述"}
          </p>
        </div>
        <Link
          href={`/evaluation-profiles/${encodeURIComponent(id)}/edit`}
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5 self-start")}
        >
          <Pencil className="size-4" />
          编辑
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">默认方案：</span>
            {row.is_default ? "是" : "否"}
          </p>
          <p>
            <span className="text-muted-foreground">测试集 id：</span>
            <span className="font-mono">{row.test_set_id ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">prepare：</span>
            <span className="font-mono text-xs">
              periods={JSON.stringify(row.prepare.forward_return_periods)} q=
              {row.prepare.quantiles ?? "null"} ls={String(row.prepare.long_short)}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">工作流 JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[min(60vh,32rem)] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {JSON.stringify(row.workflow, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </FactorFormPageContainer>
  );
}
