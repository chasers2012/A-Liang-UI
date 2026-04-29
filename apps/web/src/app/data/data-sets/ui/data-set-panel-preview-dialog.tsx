'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { previewDataSetPanel, type DataSetPanelPreviewCsvResponse } from '@/api/data-sets';

type CsvTable = {
  headers: string[];
  rows: string[][];
};

function normalizeCsvText(csv: string): string {
  // Normalize newlines for consistent parsing.
  return csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCsvRows(text: string): string[][] {
  const parsedRows: string[][] = [];
  let inQuotes = false;
  let field = '';
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Escaped quote: "" -> "
        field += '"';
        i++;
      } else {
        // Toggle quoted mode.
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n' && !inQuotes) {
      row.push(field);
      field = '';
      parsedRows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  // Flush trailing field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    parsedRows.push(row);
  }

  return parsedRows;
}

function trimTrailingEmptyRows(parsedRows: string[][]): void {
  while (parsedRows.length > 0) {
    const last = parsedRows[parsedRows.length - 1];
    if (last.every((v) => v === '')) parsedRows.pop();
    else break;
  }
}

function makeUniqueHeaders(headersRaw: string[]): string[] {
  const headers: string[] = [];
  const seen = new Map<string, number>();

  for (let idx = 0; idx < headersRaw.length; idx++) {
    const raw = String(headersRaw[idx] ?? '');
    let h = raw.trim();
    if (!h) h = `col_${idx + 1}`;

    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    if (n > 0) h = `${h}_${n + 1}`;

    headers.push(h);
  }

  return headers;
}

function makeDataRows(dataRowsRaw: string[][], colCount: number): string[][] {
  return dataRowsRaw.map((r) => {
    const out: string[] = [];
    for (let i = 0; i < colCount; i++) out.push(r[i] ?? '');
    return out;
  });
}

function parseCsvToTable(csv: string): CsvTable {
  const text = normalizeCsvText(csv);
  const parsedRows = parseCsvRows(text);
  trimTrailingEmptyRows(parsedRows);

  if (parsedRows.length === 0) return { headers: [], rows: [] };

  const headersRaw = parsedRows[0] ?? [];
  const headers = makeUniqueHeaders(headersRaw);
  const rows = makeDataRows(parsedRows.slice(1), headersRaw.length);
  return { headers, rows };
}

export function DataSetPanelPreviewDialog({
  open,
  onOpenChange,
  dataSetId,
}: {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  dataSetId: string;
}) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DataSetPanelPreviewCsvResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function run() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const next = await previewDataSetPanel(dataSetId);
        if (cancelled) return;
        setPreview(next);
      } catch (e) {
        if (cancelled) return;
        setPreviewError(e instanceof Error ? e.message : String(e));
      } finally {
        if (cancelled) return;
        setPreviewLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, dataSetId]);

  const table = useMemo(() => (preview ? parseCsvToTable(preview.csv) : null), [preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="flex flex-col gap-0 p-0">
        <DialogHeader>
          <DialogTitle>数据集预览</DialogTitle>
        </DialogHeader>
        <DialogBody variant="inset" className="space-y-4">
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">加载预处理后的数据中…</p>
          ) : previewError ? (
            <Alert variant="destructive">
              <AlertTitle>预览失败</AlertTitle>
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          ) : table && table.headers.length > 0 ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.headers.map((h) => (
                      <TableHead key={h} className="min-w-24 max-w-56 truncate font-mono text-xs">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((r, idx) => (
                    <TableRow key={idx}>
                      {r.map((v, cellIdx) => (
                        <TableCell key={`${idx}:${cellIdx}`} className="max-w-56 truncate font-mono text-xs">
                          {v}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无预览数据。</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
