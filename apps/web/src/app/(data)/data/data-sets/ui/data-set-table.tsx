"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DataSetPublic } from "@/lib/quant-agent-api";

type Props = {
  items: DataSetPublic[];
  onDelete: (row: DataSetPublic) => void;
};

function stockSummary(codes: string[]): string {
  if (!codes.length) return "全部";
  if (codes.length <= 3) return codes.join(", ");
  return `${codes.length} 只`;
}

function datasourceSummary(row: DataSetPublic): string {
  const b = row.datasource_bindings;
  if (!b.length) return "—";
  if (b.length === 1) {
    return b[0].datasource_name || b[0].datasource_id;
  }
  return `${b.length} 个数据源`;
}

export function DataSetTable({ items, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>数据源</TableHead>
          <TableHead>日期范围</TableHead>
          <TableHead>股票池</TableHead>
          <TableHead className="w-24 text-center">默认</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-w-48 whitespace-normal">
              <span className="font-mono text-sm">{row.name}</span>
              {row.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {row.description}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="whitespace-normal text-sm">
              <span className="text-foreground">{datasourceSummary(row)}</span>
            </TableCell>
            <TableCell className="font-mono text-xs tabular-nums">
              {row.start} ~ {row.end}
            </TableCell>
            <TableCell className="whitespace-normal text-sm text-muted-foreground">
              {stockSummary(row.stock_codes)}
            </TableCell>
            <TableCell className="text-center">
              {row.is_default ? (
                <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-xs font-medium">
                  默认
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/data/data-sets/${encodeURIComponent(row.id)}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  详情
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={`删除 ${row.name}`}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
