'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type AliasMapRow = {
  /** 物理列名（数据源字段名） */
  column: string;
  /** 逻辑字段名（因子依赖字段名） */
  factor: string;
  /** 为 false 时不写入 alias / dependencies */
  enabled?: boolean;
};

export function mapFromAliasRows(rows: AliasMapRow[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const r of rows) {
    if (r.enabled === false) continue;
    const logical = r.factor.trim();
    const physical = r.column.trim();
    if (!logical || !physical) continue;
    o[logical] = physical;
  }
  return o;
}

export function depsFromAliasRows(rows: AliasMapRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.enabled === false) continue;
    const logical = r.factor.trim();
    if (!logical || seen.has(logical)) continue;
    seen.add(logical);
    out.push(logical);
  }
  return out;
}

/** 将物理列清单与已有映射合并成完整行（用于有字段列表时的勾选 UI）。 */
export function mergePhysicalColumns(physicalColumns: string[], prev: AliasMapRow[]): AliasMapRow[] {
  const colToFactor = new Map<string, string>();
  for (const r of prev) {
    if (r.enabled === false) continue;
    const c = r.column.trim();
    const f = r.factor.trim();
    if (c && f) colToFactor.set(c, f);
  }
  return physicalColumns.map((column) => ({
    column,
    factor: colToFactor.get(column) ?? '',
    enabled: colToFactor.has(column),
  }));
}

type Props = {
  /** 数据源可用字段（物理列名）。为空时降级为手动表格。 */
  physicalColumns: string[];
  rows: AliasMapRow[];
  onChangeRows: (rows: AliasMapRow[]) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
};

export function AliasMapEditor({ physicalColumns, rows, onChangeRows, onAddRow, onRemoveRow }: Props) {
  const [showAllPhysical, setShowAllPhysical] = useState(true);

  const hasPhysicalList = physicalColumns.length > 0;

  const physicalSorted = useMemo(() => {
    const s = [...physicalColumns].map((c) => String(c)).filter(Boolean);
    return s.sort((a, b) => a.localeCompare(b));
  }, [physicalColumns]);

  const mergedRows = useMemo(() => {
    if (!hasPhysicalList) return rows;
    return mergePhysicalColumns(physicalSorted, rows);
  }, [hasPhysicalList, physicalSorted, rows]);

  const effectiveRows = hasPhysicalList ? mergedRows : rows;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">字段映射（数据集 alias）</Label>
        {hasPhysicalList ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAllPhysical((v) => !v)}>
            {showAllPhysical ? '仅显示已启用' : '显示全部'}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
            添加行
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        在数据集中配置逻辑字段名（如 close、volume）到数据源物理列名的映射。启用的行会写入
        <span className="font-mono"> alias </span>
        并自动生成该绑定的
        <span className="font-mono"> dependencies</span>。
      </p>

      <div className="overflow-hidden rounded-lg border border-border/80 bg-background/50">
        <Table compact>
          <TableHeader className="[&_tr:hover]:bg-muted/40">
            <TableRow>
              {hasPhysicalList ? (
                <>
                  <TableHead className="w-10 pl-3">启用</TableHead>
                  <TableHead className="w-[38%]">数据源列</TableHead>
                  <TableHead>逻辑字段名</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-[42%] pl-3">逻辑字段名</TableHead>
                  <TableHead className="w-[42%]">数据源列</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {effectiveRows
              .filter((r) => (hasPhysicalList && !showAllPhysical ? r.enabled !== false && r.factor.trim() : true))
              .map((row, index) => (
                <TableRow key={hasPhysicalList ? row.column : index}>
                  {hasPhysicalList ? (
                    <>
                      <TableCell className="pl-3">
                        <input
                          type="checkbox"
                          className={cn('size-4 rounded border border-input accent-primary', 'cursor-pointer')}
                          checked={row.enabled !== false}
                          onChange={(e) => {
                            const on = e.target.checked;
                            const next = [...effectiveRows];
                            next[index] = { ...next[index], enabled: on };
                            if (on && !row.factor.trim() && row.column.trim()) {
                              next[index] = { ...next[index], factor: row.column.trim() };
                            }
                            onChangeRows(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground/90">{row.column}</span>
                      </TableCell>
                      <TableCell className="pr-2">
                        <Input
                          className="h-8 font-mono text-xs"
                          disabled={row.enabled === false}
                          placeholder="如 close、volume"
                          value={row.factor}
                          onChange={(e) => {
                            const next = [...effectiveRows];
                            next[index] = { ...next[index], factor: e.target.value };
                            onChangeRows(next);
                          }}
                        />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="pl-2">
                        <Input
                          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                          placeholder="如 close"
                          value={row.factor}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], factor: e.target.value };
                            onChangeRows(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                          placeholder="如 adj_close"
                          value={row.column}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], column: e.target.value };
                            onChangeRows(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="pr-2 text-right">
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
                    </>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
