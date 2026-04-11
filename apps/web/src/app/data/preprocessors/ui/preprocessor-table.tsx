"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

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
import type { PreprocessorSummaryPublic } from "@/api";

type Props = {
  items: PreprocessorSummaryPublic[];
  onDelete: (row: PreprocessorSummaryPublic) => void;
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function PreprocessorTable({ items, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%]">名称</TableHead>
          <TableHead>摘要</TableHead>
          <TableHead className="w-56">更新时间</TableHead>
          <TableHead className="w-44 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="max-w-56 whitespace-normal">
              <span className="font-mono text-sm">{p.name || "未命名预处理器"}</span>
            </TableCell>
            <TableCell className="max-w-md truncate text-muted-foreground" title={p.description}>
              {p.description || "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground tabular-nums">
              {formatUpdatedAt(p.updated_at)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/data/preprocessors/${encodeURIComponent(p.id)}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  详情
                </Link>
                <div className="flex items-center gap-0.5">
                  <Link
                    href={`/data/preprocessors/${encodeURIComponent(p.id)}/edit`}
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
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

