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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { cn } from "@/lib/utils";
import {
  evaluationProfileDetailAtomFamily,
  loadEvaluationProfileDetailAtomFamily,
} from "@/models/evaluation-profile/list-detail.atom";

import { FactorFormPageContainer } from "@/app/factors/ui/factor-form-page";
import { ProfileDetailWorkflowCard } from "../ui/profile-detail-workflow-card";

export default function EvaluationProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(id));
  const load = useSetAtom(loadEvaluationProfileDetailAtomFamily(id));

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

      <ProfileDetailWorkflowCard profile={row} profileId={id} />

      <Card>
        <CardHeader>
          <CardTitle>配置摘要</CardTitle>
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
          <p className="text-muted-foreground">
            Alphalens 持有期、分位数等在工作流「计算因子」节点的节点参数中查看与编辑。
          </p>
        </CardContent>
      </Card>
    </FactorFormPageContainer>
  );
}
