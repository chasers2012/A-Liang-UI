"use client";

import { useAtomValue, useSetAtom } from "jotai";

import { Page } from "@/components/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import {
  factorsListAtom,
  refreshFactorsListAtom,
} from "@/models/factor";

import { FactorEvaluationsOverview } from "@/components/factors/ui/factor-evaluations-overview";

export function FactorSectionContent() {
  const { items } = useAtomValue(factorsListAtom);
  const refresh = useSetAtom(refreshFactorsListAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page
      title="因子"
      description="评价概览基于 workspace 中的因子列表与评价快照汇总。"
      gap="sm"
    >
      <Card className="flex min-h-[min(24rem,50vh)] min-w-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>评价概览</CardTitle>
          <CardDescription>
            基于 workspace{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
              config/factor_evaluations.json
            </code>{" "}
            的快照；与因子库列表同步。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {items === null ? (
            <div className="flex flex-1 flex-col justify-center py-12 text-center text-sm text-muted-foreground">
              加载因子列表…
            </div>
          ) : (
            <FactorEvaluationsOverview />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
