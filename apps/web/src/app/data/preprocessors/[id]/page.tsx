"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  ApiError,
  deletePreprocessor,
  getPreprocessor,
  type PreprocessorDetailPublic,
} from "@/api";
import { cn } from "@/lib/utils";

import { DeletePreprocessorDialog } from "../ui/delete-preprocessor-dialog";

function formatIso(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export default function PreprocessorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [row, setRow] = useState<PreprocessorDetailPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("无效 id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      setError(null);
      setLoading(true);
      try {
        const d = await getPreprocessor(id);
        if (!cancelled) setRow(d);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const confirmDelete = async () => {
    if (!row) return;
    setDeleting(true);
    try {
      await deletePreprocessor(row.id);
      setDeleteOpen(false);
      router.push("/data/preprocessors");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
    } finally {
      setDeleting(false);
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
          <AlertTitle>无法加载预处理器</AlertTitle>
          <AlertDescription>{error ?? "未知错误"}</AlertDescription>
        </Alert>
        <Link
          href="/data/preprocessors"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page
      title={row.name}
      description={row.description || "无说明"}
      action={
        <>
          <Link
            href={`/data/preprocessors/${encodeURIComponent(id)}/edit`}
            className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
          >
            <Pencil className="size-4" />
            编辑
          </Link>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>标识与时间</CardTitle>
          <CardDescription>存储中的元数据字段</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">source_path</dt>
              <dd className="break-all font-mono text-xs">{row.source_path}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">created_at</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatIso(row.created_at)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">updated_at</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatIso(row.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>源码</CardTitle>
          <CardDescription>用于调试与复制；编辑请进入编辑页。</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-112 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
            <code className="font-mono">{row.source}</code>
          </pre>
        </CardContent>
      </Card>

      <DeletePreprocessorDialog
        target={deleteOpen ? row : null}
        deleting={deleting}
        onDismiss={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}

