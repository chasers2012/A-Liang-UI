'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  functionalUpdate,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { getBacktestNodeCsvPage } from '@/api/backtests';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid';
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination';
import { DataGridTableVirtual } from '@/components/reui/data-grid/data-grid-table-virtual';
import type { BacktestNodeCsvPageResponse } from '@/models/backtest/dto';

export function CsvVirtualGrid({
  runId,
  nodeId,
  fileName,
  pageSize = 20,
}: {
  runId: string;
  nodeId: string;
  fileName: string;
  pageSize?: number;
}) {
  const COLUMN_WINDOW_SIZE = 120;
  const [csvPage, setCsvPage] = useState<BacktestNodeCsvPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnWindowStart, setColumnWindowStart] = useState(0);
  const headers = useMemo(() => csvPage?.headers ?? [], [csvPage]);
  const totalColumns = headers.length;
  const rows = useMemo(() => csvPage?.rows ?? [], [csvPage]);
  const page = csvPage?.pagination.page ?? 1;
  const currentPageSize = csvPage?.pagination.page_size ?? pageSize;
  const totalPages = Math.max(1, csvPage?.pagination.total_pages ?? 1);
  const totalRows = csvPage?.pagination.total_rows ?? rows.length;
  const rowNumberOffset = (page - 1) * currentPageSize;
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: Math.max(1, pageSize),
  });
  const paginationStateRef = useRef(paginationState);
  const inFlightRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    paginationStateRef.current = paginationState;
  }, [paginationState]);

  useEffect(() => {
    setPaginationState((prev) => ({
      ...prev,
      pageIndex: Math.max(0, page - 1),
      pageSize: Math.max(1, currentPageSize),
    }));
  }, [page, currentPageSize]);

  useEffect(() => {
    setColumnWindowStart(0);
  }, [fileName, headers.length]);

  const normalizedWindowStart = useMemo(() => {
    if (totalColumns <= COLUMN_WINDOW_SIZE) return 0;
    const maxStart = Math.max(0, totalColumns - COLUMN_WINDOW_SIZE);
    return Math.min(columnWindowStart, maxStart);
  }, [columnWindowStart, totalColumns]);

  const visibleHeaders = useMemo(
    () => headers.slice(normalizedWindowStart, normalizedWindowStart + COLUMN_WINDOW_SIZE),
    [headers, normalizedWindowStart],
  );
  const visibleHeaderEntries = useMemo(
    () => visibleHeaders.map((header, index) => ({ header, sourceIndex: normalizedWindowStart + index })),
    [normalizedWindowStart, visibleHeaders],
  );

  const visibleColumnRangeText = useMemo(() => {
    if (totalColumns === 0) return '';
    const start = normalizedWindowStart + 1;
    const end = Math.min(totalColumns, normalizedWindowStart + visibleHeaders.length);
    return `${start}-${end} / ${totalColumns}`;
  }, [normalizedWindowStart, totalColumns, visibleHeaders.length]);

  const loadPage = useCallback(
    async (targetPage: number) => {
      const requestKey = `${runId}:${nodeId}:${fileName}:${targetPage}:${pageSize}`;
      if (inFlightRequestKeyRef.current === requestKey) return;
      inFlightRequestKeyRef.current = requestKey;
      setLoading(true);
      setError(null);
      try {
        const res = await getBacktestNodeCsvPage({
          runId,
          nodeId,
          file: fileName,
          page: targetPage,
          pageSize,
        });
        setCsvPage(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setCsvPage(null);
      } finally {
        if (inFlightRequestKeyRef.current === requestKey) {
          inFlightRequestKeyRef.current = null;
        }
        setLoading(false);
      }
    },
    [fileName, nodeId, pageSize, runId],
  );

  useEffect(() => {
    setCsvPage(null);
    setError(null);
    setPaginationState({ pageIndex: 0, pageSize: Math.max(1, pageSize) });
    void loadPage(1);
  }, [fileName, loadPage, pageSize]);
  const columnHelper = createColumnHelper<Record<string, string>>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: '__rowNumber',
        header: '#',
        cell: (info) => <span className="font-mono text-xs">{rowNumberOffset + info.row.index + 1}</span>,
      }),
      ...visibleHeaders.map((header) =>
        columnHelper.accessor((row) => row[header] ?? '', {
          id: header,
          header,
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
      ),
    ],
    [columnHelper, rowNumberOffset, visibleHeaders],
  );
  const table = useReactTable({
    data: rows.map((r, idx) => {
      const mappedRow: Record<string, string> = { __idx: String(idx) };
      visibleHeaderEntries.forEach(({ header, sourceIndex }) => {
        mappedRow[header] = String(r[sourceIndex] ?? '');
      });
      return mappedRow;
    }),
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    rowCount: totalRows,
    state: { pagination: paginationState },
    onPaginationChange: (updater) => {
      const prev = paginationStateRef.current;
      const next = functionalUpdate(updater, prev);
      setPaginationState(next);
      if (next.pageIndex !== prev.pageIndex) void loadPage(next.pageIndex + 1);
    },
  });

  const canShiftLeft = normalizedWindowStart > 0;
  const canShiftRight = normalizedWindowStart + COLUMN_WINDOW_SIZE < totalColumns;

  if (loading) {
    return <EmptyState variant="loading" title="加载中" compact />;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (headers.length === 0) {
    return <EmptyState title="文件为空" compact />;
  }

  return (
    <DataGrid table={table} recordCount={totalRows} tableLayout={{ headerSticky: true }}>
      <DataGridContainer border className="w-full space-y-2 p-2">
        {totalColumns > COLUMN_WINDOW_SIZE && (
          <div className="flex items-center justify-end gap-2 px-1">
            <p className="text-muted-foreground text-xs">列窗口 {visibleColumnRangeText}</p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={!canShiftLeft}
              onClick={() => setColumnWindowStart((prev) => Math.max(0, prev - COLUMN_WINDOW_SIZE))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={!canShiftRight}
              onClick={() => setColumnWindowStart((prev) => prev + COLUMN_WINDOW_SIZE)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        )}
        <DataGridTableVirtual height={260} estimateSize={34} />
        <DataGridPagination
          className="pt-1"
          sizes={[currentPageSize]}
          rowsPerPageLabel="每页"
          previousPageLabel="上一页"
          nextPageLabel="下一页"
          info="{from} - {to} / {count}"
        />
      </DataGridContainer>
    </DataGrid>
  );
}
