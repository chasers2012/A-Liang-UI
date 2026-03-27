"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useAtom, useSetAtom } from "jotai";
import { Database, Plus } from "lucide-react";

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
import {
  ApiError,
  deleteDatasource,
  getQuantAgentApiBase,
  patchDatasource,
  testDatasource,
  type DataSourcePublic,
} from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import {
  datasourcesPanelAtom,
  refreshDatasourcesPanelAtom,
} from "@/models/datasource/panel.atom";

import { DatasourceTable } from "./ui/datasource-table";
import { DeleteDatasourceDialog } from "./ui/delete-datasource-dialog";

export function DatasourcesPanel() {
  const [panel, setPanel] = useAtom(datasourcesPanelAtom);
  const refresh = useSetAtom(refreshDatasourcesPanelAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const { items, loadError, busyId, testHint, deleteTarget, deleting } = panel;

  const withBusy = useCallback(
    async (id: string, fn: () => Promise<unknown>) => {
      setPanel((p) => ({ ...p, busyId: id, testHint: null }));
      try {
        await fn();
        await refresh();
      } catch (e) {
        setPanel((p) => ({
          ...p,
          loadError: e instanceof Error ? e.message : String(e),
        }));
      } finally {
        setPanel((p) => ({ ...p, busyId: null }));
      }
    },
    [refresh, setPanel],
  );

  const toggleEnabled = (ds: DataSourcePublic, enabled: boolean) =>
    void withBusy(ds.id, () => patchDatasource(ds.id, { enabled }));

  const runTest = async (ds: DataSourcePublic) => {
    setPanel((p) => ({ ...p, busyId: ds.id, testHint: null }));
    try {
      const r = await testDatasource(ds.id);
      setPanel((p) => ({
        ...p,
        testHint: { id: ds.id, ok: r.ok, message: r.message },
      }));
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setPanel((p) => ({
        ...p,
        testHint: { id: ds.id, ok: false, message: msg },
      }));
    } finally {
      setPanel((p) => ({ ...p, busyId: null }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPanel((p) => ({ ...p, deleting: true }));
    try {
      await deleteDatasource(deleteTarget.id);
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
            数据源
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            配置经{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>
            读写，落盘于服务端 workspace（
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              QUANT_AGENT_WORKSPACE
            </code>
            ，默认{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              ~/.quant-agent
            </code>
            ）。点击名称查看详情。
          </p>
        </div>
        <Link
          href="/datasources/new"
          className={cn(buttonVariants(), "shrink-0 gap-1.5")}
        >
          <Plus className="size-4" />
          新增数据源
        </Link>
      </header>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {testHint && (
        <Alert variant={testHint.ok ? "default" : "destructive"}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>已配置的数据源</CardTitle>
              <CardDescription>
                共 {count} 条；可在列表中快速启用、设默认或测试连接。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items === null && !loadError && (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
          {items && items.length === 0 && !loadError && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/5 py-16 text-center">
              <Database
                className="size-12 text-muted-foreground/40"
                strokeWidth={1.25}
              />
              <p className="text-sm text-muted-foreground">
                暂无数据源，点击「新增数据源」开始配置。
              </p>
              <Link
                href="/datasources/new"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex h-7 items-center px-2.5",
                )}
              >
                新增数据源
              </Link>
            </div>
          )}
          {items && items.length > 0 && (
            <DatasourceTable
              items={items}
              busyId={busyId}
              onToggleEnabled={toggleEnabled}
              onTest={runTest}
              onDelete={(ds) => setPanel((p) => ({ ...p, deleteTarget: ds }))}
            />
          )}
        </CardContent>
      </Card>

      <DeleteDatasourceDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setPanel((p) => ({ ...p, deleteTarget: null }))}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
