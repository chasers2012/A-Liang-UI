"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Page } from "@/components/page";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { cn } from "@/lib/utils";
import {
  datasourceDetailAtomFamily,
  loadDatasourceDetailAtomFamily,
} from "@/models/datasource/detail.atom";

import { confirmDeleteDatasource, runDatasourceConnectionTest } from "./datasource-detail-actions";
import { DatasourceDetailLoaded } from "./datasource-detail-loaded";

export default function DatasourceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [state, setState] = useAtom(datasourceDetailAtomFamily(id));
  const load = useSetAtom(loadDatasourceDetailAtomFamily(id));

  useEffectMicrotask(() => {
    void load();
  }, [id, load]);

  const { ds, error, loading, busy, testHint, deleteOpen, deleting } = state;

  const runTest = () => void runDatasourceConnectionTest(id, setState);

  const confirmDelete = async () => {
    if (!ds) return;
    await confirmDeleteDatasource(ds, router, setState);
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

  if (error || !ds) {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据源</AlertTitle>
          <AlertDescription>{error ?? "未知错误"}</AlertDescription>
        </Alert>
        <Link href="/data/datasources" className={cn(buttonVariants({ variant: "outline" }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <DatasourceDetailLoaded
      ds={ds}
      id={id}
      busy={busy}
      testHint={testHint}
      deleteOpen={deleteOpen}
      deleting={deleting}
      setState={setState}
      onRunTest={runTest}
      onConfirmDelete={confirmDelete}
    />
  );
}
