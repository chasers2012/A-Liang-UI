"use client";

import Link from "next/link";

import type { FactorSummaryPublic } from "@/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  items: FactorSummaryPublic[];
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function FactorCardList({ items }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead className="hidden sm:table-cell">分组</TableHead>
          <TableHead className="hidden sm:table-cell">依赖</TableHead>
          <TableHead className="hidden sm:table-cell">更新时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((f) => {
          const depsText = f.dependencies.join(", ");
          const href = `/factors/library/${encodeURIComponent(f.id)}`;
          return (
            <TableRow key={f.id}>
              <TableCell className="font-mono text-sm">{f.name}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {f.group}
              </TableCell>
              <TableCell
                className="hidden max-w-md truncate text-muted-foreground sm:table-cell"
                title={f.dependencies.length > 0 ? depsText : undefined}
              >
                {f.dependencies.length > 0 ? depsText : "—"}
              </TableCell>
              <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                {formatUpdatedAt(f.updated_at)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={href}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  详情
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
