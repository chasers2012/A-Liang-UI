"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import {
  deletePreprocessor,
  getQuantAgentApiBase,
  listPreprocessors,
  type PreprocessorSummaryPublic,
} from "@/api";
import { cn } from "@/lib/utils";

import { DeletePreprocessorDialog } from "./ui/delete-preprocessor-dialog";
import { PreprocessorTable } from "./ui/preprocessor-table";

export function PreprocessorsPanel() {
  const [items, setItems] = useState<PreprocessorSummaryPublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreprocessorSummaryPublic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listPreprocessors();
      setItems(rows);
    } catch (e) {
      setItems([]);
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
      await deletePreprocessor(deleteTarget.id);
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
    <Page
      title="预处理器"
      description={
        <>
          预处理器源码与元数据经{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            {getQuantAgentApiBase()}
          </code>{" "}
          读写，落盘于服务端 workspace。创建时将从 source 中解析继承{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            DataPreprocessorBase
          </code>{" "}
          的类。
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
          <CardTitle>已配置的预处理器</CardTitle>
          <CardDescription>共 {count} 条；可编辑源码、名称与说明。</CardDescription>
          <CardAction>
            <Link
              href="/data/preprocessors/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" />
              新增预处理器
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {items === null && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          )}
          {items && items.length === 0 && !loadError && (
            <p className="p-6 text-sm text-muted-foreground">
              暂无预处理器。请使用上方「新增预处理器」开始配置。
            </p>
          )}
          {items && items.length > 0 && (
            <PreprocessorTable items={items} onDelete={setDeleteTarget} />
          )}
        </CardContent>
      </Card>

      <DeletePreprocessorDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}

