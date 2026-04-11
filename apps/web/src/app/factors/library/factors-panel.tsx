"use client";

import Link from "next/link";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";

import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getQuantAgentApiBase } from "@/api";
import { factorsListAtom, refreshFactorsListAtom } from "@/models/factor";

import { FactorCardList } from "@/app/factors/ui/factor-card-list";

export function FactorsPanel() {
  const { items, error: loadError } = useAtomValue(factorsListAtom);
  const refresh = useSetAtom(refreshFactorsListAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const count = items?.length ?? 0;

  return (
    <Page
      title="因子库"
      description={
        <>
          因子配置经{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            {getQuantAgentApiBase()}
          </code>{" "}
          读写，落盘于服务端 workspace（
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            QUANT_AGENT_WORKSPACE
          </code>
          ，默认{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            ~/.quant-agent
          </code>
          ）下的{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            config/factors.json
          </code>{" "}
          与{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            factors/
          </code>
          。
        </>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>因子列表</CardTitle>
          <CardDescription>
            共 {count} 条。点击「详情」进入编辑与评价、历史；窄屏仅显示名称与操作。评价汇总见「因子」页。
          </CardDescription>
          <CardAction>
            <Link
              href="/factors/library/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" />
              新增因子
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto p-0">
          {items === null && !loadError && (
            <div className="flex flex-1 flex-col justify-center px-6 py-12 text-center text-sm text-muted-foreground">
              加载因子列表…
            </div>
          )}
          {items && items.length === 0 && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">
              暂无因子。请使用上方「新增因子」创建并保存到 workspace。
            </p>
          )}
          {items && items.length > 0 && <FactorCardList items={items} />}
        </CardContent>
      </Card>
    </Page>
  );
}
