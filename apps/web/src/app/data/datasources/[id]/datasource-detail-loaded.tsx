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
  const configPretty = JSON.stringify(ds.config ?? {}, null, 2);

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-2">
          {ds.name}
          <span className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {ds.type}
          </span>
        </span>
      }
      description={
        <span className="font-mono text-xs break-all" title={summary}>
          {summary}
        </span>
      }
      action={
        <>
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
            href={`/data/datasources/${encodeURIComponent(id)}/edit`}
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
        </>
      }
    >
      {testHint && (
        <Alert variant={testHint.ok ? "default" : "destructive"}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>状态与标识</CardTitle>
          <CardDescription>与列表中开关一致，修改后立即保存</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle>插件配置（config）</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
            {configPretty}
          </pre>
        </CardContent>
      </Card>

      <DeleteDatasourceDialog
        target={deleteOpen ? ds : null}
        deleting={deleting}
        onDismiss={() => setState((s) => ({ ...s, deleteOpen: false }))}
        onConfirm={onConfirmDelete}
      />
    </Page>
  );
}
