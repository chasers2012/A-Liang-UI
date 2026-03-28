"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import { Pencil, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Page } from "@/components/page";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { deleteEvaluationTestSet } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import {
  loadTestSetDetailAtomFamily,
  testSetDetailAtomFamily,
} from "@/models/evaluation-test-set/panel-detail.atom";

import { DeleteTestSetDialog } from "../ui/delete-test-set-dialog";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export default function TestSetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [state, setState] = useAtom(testSetDetailAtomFamily(id));
  const load = useSetAtom(loadTestSetDetailAtomFamily(id));

  useEffectMicrotask(() => {
    void load();
  }, [id, load]);

  const { row, error, loading, deleteOpen, deleting } = state;

  const confirmDelete = async () => {
    if (!row) return;
    setState((s) => ({ ...s, deleting: true }));
    try {
      await deleteEvaluationTestSet(row.id);
      setState((s) => ({ ...s, deleteOpen: false }));
      router.push("/test-sets");
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setState((s) => ({ ...s, deleting: false }));
    }
  };

  if (!id) {
    return (
      <Page gap="none">
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page gap="none">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (error || !row) {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载测试集</AlertTitle>
          <AlertDescription>{error ?? "未知错误"}</AlertDescription>
        </Alert>
        <Link href="/test-sets" className={cn(buttonVariants({ variant: "outline" }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {row.name}
          </h1>
          {row.description ? (
            <p className="text-sm text-muted-foreground">{row.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground/70">无说明</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/test-sets/${encodeURIComponent(id)}/edit`}
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

      <Card>
        <CardHeader>
          <CardTitle>标识与时间</CardTitle>
          <CardDescription>存储中的完整元数据字段</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">id</dt>
              <dd className="break-all font-mono text-xs">{row.id}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">is_default</dt>
              <dd>{row.is_default ? "是" : "否"}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">created_at</dt>
              <dd className="font-mono text-xs tabular-nums">{formatIso(row.created_at)}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">updated_at</dt>
              <dd className="font-mono text-xs tabular-nums">{formatIso(row.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>数据源绑定</CardTitle>
          <CardDescription>
            datasource_id、datasource_name、datasource_type、dependencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {row.datasource_bindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">无绑定</p>
          ) : (
            row.datasource_bindings.map((b, i) => (
              <div
                key={`${b.datasource_id}-${i}`}
                className="rounded-lg border border-border/60 bg-muted/5 p-4 text-sm"
              >
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  绑定 {i + 1}
                </p>
                <dl className="grid gap-2">
                  <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                    <dt className="text-muted-foreground">datasource_id</dt>
                    <dd className="break-all font-mono text-xs">{b.datasource_id}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                    <dt className="text-muted-foreground">datasource_name</dt>
                    <dd>{b.datasource_name || "—"}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                    <dt className="text-muted-foreground">datasource_type</dt>
                    <dd className="font-mono text-xs">{b.datasource_type || "—"}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                    <dt className="text-muted-foreground">dependencies</dt>
                    <dd className="font-mono text-xs">
                      {b.dependencies.length ? b.dependencies.join(", ") : "（空：单源时使用因子全部依赖）"}
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/datasources"
                  className="mt-3 inline-block text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  在数据源列表中查看
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>评价参数</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">start</dt>
              <dd className="font-mono text-xs tabular-nums">{row.start}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">end</dt>
              <dd className="font-mono text-xs tabular-nums">{row.end}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">stock_codes</dt>
              <dd className="font-mono text-xs break-all">
                {row.stock_codes.length
                  ? row.stock_codes.join(", ")
                  : "（空数组：不限制标的）"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <DeleteTestSetDialog
        target={deleteOpen ? row : null}
        deleting={deleting}
        onDismiss={() => setState((s) => ({ ...s, deleteOpen: false }))}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
