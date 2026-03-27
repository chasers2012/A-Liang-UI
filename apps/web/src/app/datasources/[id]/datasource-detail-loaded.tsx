"use client";

import Link from "next/link";
import { Pencil, Trash2, Zap } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Page } from "@/components/page";
import { cn } from "@/lib/utils";
import type { DatasourceDetailState } from "@/models/datasource/detail.atom";
import type { DataSourcePublic } from "@/models/datasource/dto";

import { datasourceSummary } from "../datasource-summary";
import { DeleteDatasourceDialog } from "../ui/delete-datasource-dialog";

import { patchDatasourceEnabled } from "./datasource-detail-actions";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

type SetDetailState = (
  update: (prev: DatasourceDetailState) => DatasourceDetailState,
) => void;

type Props = {
  ds: DataSourcePublic;
  id: string;
  busy: boolean;
  testHint: DatasourceDetailState["testHint"];
  deleteOpen: boolean;
  deleting: boolean;
  setState: SetDetailState;
  load: () => Promise<void>;
  onRunTest: () => void;
  onConfirmDelete: () => void | Promise<void>;
};

export function DatasourceDetailLoaded({
  ds,
  id,
  busy,
  testHint,
  deleteOpen,
  deleting,
  setState,
  load,
  onRunTest,
  onConfirmDelete,
}: Props) {
  const summary = datasourceSummary(ds);

  return (
    <Page>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {ds.name}
            </h1>
            <span className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {ds.type}
            </span>
          </div>
          <p
            className="font-mono text-xs text-muted-foreground break-all"
            title={summary}
          >
            {summary}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void onRunTest()}
          >
            <Zap className="size-4" />
            测试连接
          </Button>
          <Link
            href={`/datasources/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
          >
            <Pencil className="size-4" />
            编辑
          </Link>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setState((s) => ({ ...s, deleteOpen: true }))}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </div>

      {testHint && (
        <Alert variant={testHint.ok ? "default" : "destructive"}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <CardTitle className="text-base">状态与标识</CardTitle>
          <CardDescription>与列表中开关一致，修改后立即保存</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">id</dt>
              <dd className="break-all font-mono text-xs">{ds.id}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-x-4">
              <dt className="text-muted-foreground">enabled</dt>
              <dd>
                <Switch
                  checked={ds.enabled}
                  disabled={busy}
                  onCheckedChange={(v) =>
                    void patchDatasourceEnabled(ds.id, v, load, setState)
                  }
                />
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">created_at</dt>
              <dd className="font-mono text-xs tabular-nums">{formatIso(ds.created_at)}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">updated_at</dt>
              <dd className="font-mono text-xs tabular-nums">{formatIso(ds.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {ds.type === "sql" && ds.sql && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">SQL 配置（公开字段）</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <dl className="grid gap-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">db_driver</dt>
                <dd className="font-mono text-xs">{ds.sql.db_driver}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">db_host</dt>
                <dd className="break-all font-mono text-xs">{ds.sql.db_host}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">db_port</dt>
                <dd className="font-mono tabular-nums">
                  {ds.sql.db_port ?? "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">db_username</dt>
                <dd className="font-mono text-xs">{ds.sql.db_username}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">db_name</dt>
                <dd className="break-all font-mono text-xs">{ds.sql.db_name}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">has_password</dt>
                <dd>{ds.sql.has_password ? "是" : "否"}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">has_legacy_engine_url</dt>
                <dd>{ds.sql.has_legacy_engine_url ? "是" : "否"}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">table</dt>
                <dd className="break-all font-mono text-xs">{ds.sql.table}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">date_column</dt>
                <dd className="font-mono text-xs">{ds.sql.date_column}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">asset_column</dt>
                <dd className="font-mono text-xs">{ds.sql.asset_column}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">column_map</dt>
                <dd className="break-all font-mono text-xs">
                  {JSON.stringify(ds.sql.column_map, null, 0)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {ds.type === "csv" && ds.csv && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
            <CardTitle className="text-base">CSV 配置</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <dl className="grid gap-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">path</dt>
                <dd className="break-all font-mono text-xs">{ds.csv.path}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">date_column</dt>
                <dd className="font-mono text-xs">{ds.csv.date_column}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">asset_column</dt>
                <dd className="font-mono text-xs">{ds.csv.asset_column}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">read_csv_kwargs</dt>
                <dd className="break-all font-mono text-xs">
                  {JSON.stringify(ds.csv.read_csv_kwargs, null, 2)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <DeleteDatasourceDialog
        target={deleteOpen ? ds : null}
        deleting={deleting}
        onDismiss={() => setState((s) => ({ ...s, deleteOpen: false }))}
        onConfirm={onConfirmDelete}
      />
    </Page>
  );
}
