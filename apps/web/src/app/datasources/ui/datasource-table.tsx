"use client";

import Link from "next/link";
import { Pencil, Trash2, Zap } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataSourcePublic } from "@/lib/quant-agent-api";

import { datasourceSummary } from "../datasource-summary";

type Props = {
  items: DataSourcePublic[];
  busyId: string | null;
  onToggleEnabled: (ds: DataSourcePublic, enabled: boolean) => void;
  onToggleDefault: (ds: DataSourcePublic, isDefault: boolean) => void;
  onTest: (ds: DataSourcePublic) => void;
  onDelete: (ds: DataSourcePublic) => void;
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function DatasourceTable({
  items,
  busyId,
  onToggleEnabled,
  onToggleDefault,
  onTest,
  onDelete,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="border-border/80 hover:bg-muted/40">
            <TableHead className="w-[18%] pl-4 font-medium">名称</TableHead>
            <TableHead className="w-20 font-medium">类型</TableHead>
            <TableHead className="font-medium">摘要</TableHead>
            <TableHead className="w-24 text-center font-medium">启用</TableHead>
            <TableHead className="w-24 text-center font-medium">默认</TableHead>
            <TableHead className="w-44 font-medium">更新时间</TableHead>
            <TableHead className="w-36 pr-4 text-right font-medium">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((ds) => {
            const summary = datasourceSummary(ds);
            return (
              <TableRow
                key={ds.id}
                className="border-border/60 transition-colors hover:bg-muted/30"
              >
                <TableCell className="pl-4 font-medium">
                  <Link
                    href={`/datasources/${encodeURIComponent(ds.id)}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {ds.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {ds.type}
                  </span>
                </TableCell>
                <TableCell
                  className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground"
                  title={summary}
                >
                  {summary}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={ds.enabled}
                      disabled={busyId === ds.id}
                      onCheckedChange={(v) => onToggleEnabled(ds, v)}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={ds.is_default}
                      disabled={busyId === ds.id || !ds.enabled}
                      onCheckedChange={(v) => onToggleDefault(ds, v)}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatUpdatedAt(ds.updated_at)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-0.5">
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
                      href={`/datasources/${encodeURIComponent(ds.id)}/edit`}
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
