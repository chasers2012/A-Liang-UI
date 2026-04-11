"use client";

import Link from "next/link";
import { Pencil, Trash2, Zap } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataSourcePublic } from "@/api";

import { datasourceSummary } from "../datasource-summary";

type Props = {
  items: DataSourcePublic[];
  busyId: string | null;
  onTest: (ds: DataSourcePublic) => void;
  onDelete: (ds: DataSourcePublic) => void;
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function DatasourceTable({
  items,
  busyId,
  onTest,
  onDelete,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">名称</TableHead>
          <TableHead className="w-20">类型</TableHead>
          <TableHead>摘要</TableHead>
          <TableHead className="w-44">更新时间</TableHead>
          <TableHead className="w-44 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((ds) => {
          const summary = datasourceSummary(ds);
          return (
            <TableRow key={ds.id}>
              <TableCell className="font-mono text-sm">{ds.name}</TableCell>
              <TableCell>
                <span className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ds.type}
                </span>
              </TableCell>
              <TableCell
                className="max-w-md truncate text-muted-foreground"
                title={summary}
              >
                {summary}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {formatUpdatedAt(ds.updated_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href={`/data/datasources/${encodeURIComponent(ds.id)}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    详情
                  </Link>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="测试连接"
                      disabled={busyId === ds.id}
                      onClick={() => onTest(ds)}
                    >
                      <Zap className="size-4" />
                    </Button>
                    <Link
                      href={`/data/datasources/${encodeURIComponent(ds.id)}/edit`}
                      title="编辑"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "inline-flex size-7 items-center justify-center",
                      )}
                    >
                      <Pencil className="size-4" aria-hidden />
                      <span className="sr-only">编辑</span>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="删除"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(ds)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
