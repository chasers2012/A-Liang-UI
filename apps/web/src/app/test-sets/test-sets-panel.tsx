"use client";

import Link from "next/link";
import { useAtom, useSetAtom } from "jotai";
import { FlaskConical, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Page } from "@/components/page";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { deleteEvaluationTestSet, getQuantAgentApiBase } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import {
  refreshTestSetsPanelAtom,
  testSetsPanelAtom,
} from "@/models/evaluation-test-set/panel-detail.atom";

import { DeleteTestSetDialog } from "./ui/delete-test-set-dialog";
import { TestSetTable } from "./ui/test-set-table";

export function TestSetsPanel() {
  const [panel, setPanel] = useAtom(testSetsPanelAtom);
  const refresh = useSetAtom(refreshTestSetsPanelAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const { items, loadError, deleteTarget, deleting } = panel;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPanel((p) => ({ ...p, deleting: true }));
    try {
      await deleteEvaluationTestSet(deleteTarget.id);
      setPanel((p) => ({ ...p, deleteTarget: null }));
      await refresh();
    } catch (e) {
      setPanel((p) => ({
        ...p,
        loadError: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setPanel((p) => ({ ...p, deleting: false }));
    }
  };

  const count = items?.length ?? 0;

  return (
    <Page>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            测试集
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            配置因子评价的数据源绑定、日期区间与股票池。列表经{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>
            读写；点击名称查看完整字段。
          </p>
        </div>
        <Link
          href="/test-sets/new"
          className={cn(buttonVariants(), "shrink-0 gap-1.5")}
        >
          <Plus className="size-4" />
          新增测试集
        </Link>
      </header>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">已配置的测试集</CardTitle>
              <CardDescription>
                共 {count} 条；支持多数据源绑定，详情页展示全部存储字段。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {items === null && !loadError && (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
          {items && items.length === 0 && !loadError && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/5 py-16 text-center">
              <FlaskConical
                className="size-12 text-muted-foreground/40"
                strokeWidth={1.25}
              />
              <p className="text-sm text-muted-foreground">
                暂无测试集，点击「新增测试集」开始配置。
              </p>
              <Link
                href="/test-sets/new"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex h-7 items-center px-2.5",
                )}
              >
                新增测试集
              </Link>
            </div>
          )}
          {items && items.length > 0 && (
            <TestSetTable
              items={items}
              onDelete={(t) => setPanel((p) => ({ ...p, deleteTarget: t }))}
            />
          )}
        </CardContent>
      </Card>

      <DeleteTestSetDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setPanel((p) => ({ ...p, deleteTarget: null }))}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
