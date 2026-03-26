"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import {
  deleteEvaluationTestSet,
  getQuantAgentApiBase,
  listEvaluationTestSets,
  type EvaluationTestSetPublic,
} from "@/lib/quant-agent-api";

import { DeleteTestSetDialog } from "./ui/delete-test-set-dialog";
import { TestSetTable } from "./ui/test-set-table";

export function TestSetsPanel() {
  const [items, setItems] = useState<EvaluationTestSetPublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<EvaluationTestSetPublic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await listEvaluationTestSets());
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
      await deleteEvaluationTestSet(deleteTarget.id);
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
            </code>{" "}
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
            <TestSetTable items={items} onDelete={setDeleteTarget} />
          )}
        </CardContent>
      </Card>

      <DeleteTestSetDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
