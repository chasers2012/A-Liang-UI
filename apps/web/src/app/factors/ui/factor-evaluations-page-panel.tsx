"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

import { Page } from "@/components/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getQuantAgentApiBase } from "@/lib/quant-agent-api";

export function FactorEvaluationsPagePanel() {
  return (
    <Page>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          评价体系
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          配置{" "}
          <Link
            href="/evaluation-profiles"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            评价方案
          </Link>{" "}
          （节点图工作流与 Alphalens 参数）与{" "}
          <Link
            href="/evaluation-metrics"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            评价指标
          </Link>
          （自定义 EvaluationMetric 源码）。各因子 IC、Spread 汇总请在{" "}
          <Link
            href="/factors"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            因子库
          </Link>{" "}
          「评价概览」查看与刷新。
        </p>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 shrink-0" aria-hidden />
            配置与数据流
          </CardTitle>
          <CardDescription>
            API 基址{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>
            ；数据由服务端 workspace（
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              QUANT_AGENT_WORKSPACE
            </code>
            ，默认{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              ~/.quant-agent
            </code>
            ）承载。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 text-sm leading-relaxed text-muted-foreground">
          <ul className="list-inside list-disc space-y-2">
            <li>
              因子定义与代码：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                config/factors.json
              </code>
              与{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                factors/
              </code>
              目录。
            </li>
            <li>
              评价结果快照汇总：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                config/factor_evaluations.json
              </code>
              ，在因子库「评价概览」与运行评价时更新。
            </li>
            <li>
              评价方案：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                config/evaluation_profiles.json
              </code>
              ；评价指标：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                config/evaluation_metrics.json
              </code>
              与{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                evaluation_metrics/
              </code>
              。
            </li>
          </ul>
          <p>
            测试集、数据源等评测输入可在「数据」菜单中配置；与因子评价流水线对接时，请保持
            workspace 路径与 API 使用的{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              QUANT_AGENT_WORKSPACE
            </code>{" "}
            一致。
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
