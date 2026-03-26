"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ColumnMapRow } from "../form-model";

type Props = {
  rows: ColumnMapRow[];
  onChangeRow: (
    index: number,
    field: keyof ColumnMapRow,
    value: string,
  ) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
};

export function ColumnMapEditor({
  rows,
  onChangeRow,
  onAddRow,
  onRemoveRow,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">字段映射</Label>
        <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
          添加行
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        将因子依赖名映射到表中的实际列名（空行会被忽略）。
      </p>
      <div className="overflow-hidden rounded-lg border border-border/80 bg-background/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 w-[42%] pl-3 text-xs font-medium">
                因子字段
              </TableHead>
              <TableHead className="h-9 w-[42%] text-xs font-medium">
                数据库列
              </TableHead>
              <TableHead className="h-9 w-24 text-right text-xs font-medium">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index} className="border-border/60">
                <TableCell className="p-1.5 pl-2 align-middle">
                  <Input
                    className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                    placeholder="如 close"
                    value={row.factor}
                    onChange={(e) =>
                      onChangeRow(index, "factor", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell className="p-1.5 align-middle">
                  <Input
                    className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                    placeholder="如 adj_close"
                    value={row.column}
                    onChange={(e) =>
                      onChangeRow(index, "column", e.target.value)
                    }
                  />
                </TableCell>
                <TableCell className="p-1.5 pr-2 text-right align-middle">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveRow(index)}
                  >
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
