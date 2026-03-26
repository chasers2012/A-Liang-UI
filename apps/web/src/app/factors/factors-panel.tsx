"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Library, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteFactor,
  getQuantAgentApiBase,
  listFactors,
  type FactorSummaryPublic,
} from "@/lib/quant-agent-api";

import { DeleteFactorDialog } from "./ui/delete-factor-dialog";
import { FactorCardList } from "./ui/factor-card-list";

export function FactorsPanel() {
  const [items, setItems] = useState<FactorSummaryPublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FactorSummaryPublic | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await listFactors());
    } catch (e) {
      setItems(null);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFactor(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const count = items?.length ?? 0;

  return (
    <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            因子库
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
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
          </p>
        </div>
        <Link
          href="/factors/new"
          className={cn(buttonVariants(), "shrink-0 gap-1.5")}
        >
          <Plus className="size-4" />
          新增因子
        </Link>
      </header>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-stretch">
        <Card className="flex h-full min-h-[min(24rem,50vh)] min-w-0 flex-col border-border/80 shadow-sm lg:min-h-0">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">因子列表</CardTitle>
            <CardDescription>
              共 {count} 条；每张卡片内可编辑或删除。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pt-6">
            {items && items.length === 0 && !loadError && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/5 py-12 text-center">
                <Library
                  className="size-10 text-muted-foreground/40"
                  strokeWidth={1.25}
                />
                <p className="px-2 text-sm text-muted-foreground">
                  暂无因子，前往「新增因子」创建并保存到 workspace。
                </p>
                <Link
                  href="/factors/new"
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                  )}
                >
                  新增因子
                </Link>
              </div>
            )}
            {items && items.length > 0 && (
              <div className="min-w-0">
                <FactorCardList items={items} onDelete={setDeleteTarget} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-[min(24rem,50vh)] min-w-0 flex-col border-border/80 shadow-sm lg:min-h-0">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">概览</CardTitle>
            <CardDescription>选中因子的摘要与统计将显示于此。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">占位</p>
            <p className="max-w-xs text-xs text-muted-foreground/80">
              后续可在此展示依赖图、窗口、最近更新等信息。
            </p>
          </CardContent>
        </Card>
      </div>

      <DeleteFactorDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
