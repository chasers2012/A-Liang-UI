"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getQuantAgentApiBase,
  listEvaluationProfiles,
  type EvaluationProfilePublic,
} from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";

export default function EvaluationProfilesPage() {
  const [items, setItems] = useState<EvaluationProfilePublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listEvaluationProfiles());
    } catch (e) {
      setItems(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            评价方案
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            配置评价流程（节点图 JSON）与 Alphalens 参数；运行因子评价时可选用方案。API{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>
          </p>
        </div>
        <Link
          href="/evaluation-profiles/new"
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5 self-start")}
        >
          <Plus className="size-4" />
          新增方案
        </Link>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <CardTitle className="text-base">方案列表</CardTitle>
          <CardDescription>
            工作流非空时按图执行；空工作流时仅用本页的 prepare 参数与测试集覆盖
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">暂无方案</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden sm:table-cell">默认</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.name}</span>
                      {p.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {p.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {p.is_default ? "是" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/evaluation-profiles/${encodeURIComponent(p.id)}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        详情
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
