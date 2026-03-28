"use client";

import Link from "next/link";
import { useAtom, useSetAtom } from "jotai";
import { Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
    <Page
      title="测试集"
      description={
        <>
          配置因子评价的数据源绑定、日期区间与股票池。列表经{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            {getQuantAgentApiBase()}
          </code>
          读写；使用「详情」查看完整字段。
        </>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>已配置的测试集</CardTitle>
          <CardDescription>
            共 {count} 条；支持多数据源绑定，详情页展示全部存储字段。
          </CardDescription>
          <CardAction>
            <Link
              href="/data/test-sets/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" />
              新增测试集
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {items === null && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          )}
          {items && items.length === 0 && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">
              暂无测试集。请使用上方「新增测试集」开始配置。
            </p>
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
