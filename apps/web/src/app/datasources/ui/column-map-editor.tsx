"use client";

import { useCallback, useState } from "react";

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
import { fetchSqlTableColumns } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";

import {
  parseOptionalPort,
  type ColumnMapRow,
  type SqlDriverForm,
} from "../form-model";

type InspectContext = {
  datasourceId: string | null;
  db_driver: SqlDriverForm;
  db_host: string;
  db_port: string;
  db_username: string;
  db_password: string;
  db_name: string;
  table: string;
};

type Props = {
  rows: ColumnMapRow[];
  onChangeRow: (
    index: number,
    field: keyof ColumnMapRow,
    value: string | boolean,
  ) => void;
  /** 用当前表单中的映射与接口返回的列名合并后写回表单（函数式更新，避免闭包过期） */
  onApplyLoadedColumns: (apiColumns: string[]) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  inspectContext: InspectContext | null;
};

export function ColumnMapEditor({
  rows,
  onChangeRow,
  onApplyLoadedColumns,
  onAddRow,
  onRemoveRow,
  inspectContext,
}: Props) {
  const [loadingCols, setLoadingCols] = useState(false);
  const [loadColsError, setLoadColsError] = useState<string | null>(null);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);

  const loadColumns = useCallback(async () => {
    if (!inspectContext) return;
    const t = inspectContext.table.trim();
    if (!t) {
      setLoadColsError("请先填写表名");
      return;
    }
    setLoadColsError(null);
    setLoadingCols(true);
    try {
      let dbPort: number | null | undefined;
      try {
        dbPort = parseOptionalPort(inspectContext.db_port);
      } catch (e) {
        setLoadColsError(e instanceof Error ? e.message : String(e));
        setLoadingCols(false);
        return;
      }
      const { columns } = await fetchSqlTableColumns({
        datasource_id: inspectContext.datasourceId,
        db_driver: inspectContext.db_driver,
        db_host: inspectContext.db_host.trim(),
        db_port: dbPort ?? null,
        db_username: inspectContext.db_username.trim(),
        db_password: inspectContext.db_password,
        db_name: inspectContext.db_name.trim(),
        table: t,
      });
      if (columns.length === 0) {
        setLoadColsError("未返回任何列（请确认表名与权限）");
        setLoadingCols(false);
        return;
      }
      onApplyLoadedColumns(columns);
      setHasLoadedFromDb(true);
    } catch (e) {
      setLoadColsError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCols(false);
    }
  }, [inspectContext, onApplyLoadedColumns]);

  const showFullColumnTable = hasLoadedFromDb && rows.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">字段映射</Label>
        {inspectContext ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingCols}
            onClick={() => void loadColumns()}
          >
            {loadingCols ? "加载中…" : "从数据库加载列"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        加载后将列出该表全部列：勾选需参与因子映射的列，并填写映射名称（写入{" "}
        <span className="font-mono">column_map</span> 的键，对应因子依赖名）。
        未勾选列不会保存到映射中。
      </p>
      {loadColsError ? (
        <p className="text-xs text-destructive">{loadColsError}</p>
      ) : null}

      {showFullColumnTable ? (
        <div className="overflow-hidden rounded-lg border border-border/80 bg-background/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-10 pl-3 text-xs font-medium">
                  启用
                </TableHead>
                <TableHead className="h-9 w-[34%] text-xs font-medium">
                  数据库列
                </TableHead>
                <TableHead className="h-9 text-xs font-medium">
                  映射名称
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.column || index} className="border-border/60">
                  <TableCell className="p-1.5 pl-3 align-middle">
                    <input
                      type="checkbox"
                      className={cn(
                        "size-4 rounded border border-input accent-primary",
                        "cursor-pointer",
                      )}
                      checked={row.enabled !== false}
                      onChange={(e) => {
                        const on = e.target.checked;
                        onChangeRow(index, "enabled", on);
                        if (
                          on &&
                          !row.factor.trim() &&
                          row.column.trim()
                        ) {
                          onChangeRow(index, "factor", row.column.trim());
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="p-1.5 align-middle">
                    <span className="font-mono text-xs text-foreground/90">
                      {row.column}
                    </span>
                  </TableCell>
                  <TableCell className="p-1.5 pr-2 align-middle">
                    <Input
                      className="h-8 font-mono text-xs"
                      disabled={row.enabled === false}
                      placeholder="如 close、volume"
                      value={row.factor}
                      onChange={(e) =>
                        onChangeRow(index, "factor", e.target.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              尚未从库中加载列时，可手动添加映射行。
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
              添加行
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/80 bg-background/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 w-[42%] pl-3 text-xs font-medium">
                    映射名称
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
        </>
      )}
    </div>
  );
}
