"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { FieldPair } from "./form-section";

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
  dateColumn: string;
  assetColumn: string;
  onDateColumnChange: (value: string) => void;
  onAssetColumnChange: (value: string) => void;
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
  dateColumn,
  assetColumn,
  onDateColumnChange,
  onAssetColumnChange,
  onChangeRow,
  onApplyLoadedColumns,
  onAddRow,
  onRemoveRow,
  inspectContext,
}: Props) {
  const [loadingCols, setLoadingCols] = useState(false);
  const [loadColsError, setLoadColsError] = useState<string | null>(null);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  const loadGenerationRef = useRef(0);
  const loadColumnsRef = useRef<() => Promise<void>>(async () => {});

  const columnSelectOptions = useMemo(() => {
    const fromRows = rows
      .map((r) => r.column.trim())
      .filter((c) => c.length > 0);
    const set = new Set(fromRows);
    const d = dateColumn.trim();
    const a = assetColumn.trim();
    if (d) set.add(d);
    if (a) set.add(a);
    return [...set].sort((x, y) => x.localeCompare(y));
  }, [rows, dateColumn, assetColumn]);

  const useColumnSelects = columnSelectOptions.length > 0;

  const loadColumns = useCallback(async () => {
    if (!inspectContext) return;
    const t = inspectContext.table.trim();
    if (!t) {
      setLoadColsError("请先填写表名");
      return;
    }
    const host = inspectContext.db_host.trim();
    const dbName = inspectContext.db_name.trim();
    if (!inspectContext.datasourceId && (!host || !dbName)) {
      setLoadColsError("请先填写主机与数据库名");
      return;
    }
    const generation = ++loadGenerationRef.current;
    setLoadColsError(null);
    setLoadingCols(true);
    try {
      let dbPort: number | null | undefined;
      try {
        dbPort = parseOptionalPort(inspectContext.db_port);
      } catch (e) {
        if (generation === loadGenerationRef.current) {
          setLoadColsError(e instanceof Error ? e.message : String(e));
          setLoadingCols(false);
        }
        return;
      }
      const { columns } = await fetchSqlTableColumns({
        datasource_id: inspectContext.datasourceId,
        db_driver: inspectContext.db_driver,
        db_host: host,
        db_port: dbPort ?? null,
        db_username: inspectContext.db_username.trim(),
        db_password: inspectContext.db_password,
        db_name: dbName,
        table: t,
      });
      if (generation !== loadGenerationRef.current) return;
      if (columns.length === 0) {
        setLoadColsError("未返回任何列（请确认表名与权限）");
        return;
      }
      onApplyLoadedColumns(columns);
      setHasLoadedFromDb(true);
    } catch (e) {
      if (generation === loadGenerationRef.current) {
        setLoadColsError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoadingCols(false);
      }
    }
  }, [inspectContext, onApplyLoadedColumns]);

  loadColumnsRef.current = loadColumns;

  useEffect(() => {
    if (!inspectContext) return;
    const t = inspectContext.table.trim();
    const host = inspectContext.db_host.trim();
    const dbName = inspectContext.db_name.trim();
    if (!t) return;
    if (!inspectContext.datasourceId && (!host || !dbName)) return;

    const timer = window.setTimeout(() => {
      void loadColumnsRef.current();
    }, 480);
    return () => clearTimeout(timer);
  }, [inspectContext]);

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
            {loadingCols ? "刷新中…" : "刷新"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        表名与连接信息就绪后会自动拉取列名；也可点击「刷新」重新获取。随后用下拉框选择日期列与资产列，并在下方勾选需参与因子映射的列、填写映射名称（
        <span className="font-mono">column_map</span> 的键）。未勾选列不会保存到映射中。
      </p>
      <FieldPair>
        <div className="grid gap-2">
          <Label htmlFor="ds-dcol">日期列</Label>
          {useColumnSelects ? (
            <Select
              modal={false}
              value={dateColumn.trim() || undefined}
              onValueChange={(v) => {
                if (v != null) onDateColumnChange(v);
              }}
            >
              <SelectTrigger id="ds-dcol" className="w-full font-mono text-xs">
                <SelectValue placeholder="选择列" />
              </SelectTrigger>
              <SelectContent>
                {columnSelectOptions.map((c) => (
                  <SelectItem key={c} value={c} className="font-mono text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ds-dcol"
              required
              className="font-mono text-xs"
              placeholder="自动加载列或手动填写映射后可下拉选择"
              value={dateColumn}
              onChange={(e) => onDateColumnChange(e.target.value)}
            />
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ds-acol">资产列</Label>
          {useColumnSelects ? (
            <Select
              modal={false}
              value={assetColumn.trim() || undefined}
              onValueChange={(v) => {
                if (v != null) onAssetColumnChange(v);
              }}
            >
              <SelectTrigger id="ds-acol" className="w-full font-mono text-xs">
                <SelectValue placeholder="选择列" />
              </SelectTrigger>
              <SelectContent>
                {columnSelectOptions.map((c) => (
                  <SelectItem key={`a-${c}`} value={c} className="font-mono text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ds-acol"
              required
              className="font-mono text-xs"
              placeholder="自动加载列或手动填写映射后可下拉选择"
              value={assetColumn}
              onChange={(e) => onAssetColumnChange(e.target.value)}
            />
          )}
        </div>
      </FieldPair>
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
