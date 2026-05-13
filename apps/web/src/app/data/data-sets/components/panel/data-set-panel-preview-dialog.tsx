'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export function DataSetPanelPreviewTabContent({ dataSetId }: { dataSetId: string }) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DataSetPanelPreviewCsvResponse | null>(null);

  useEffect(() => {
    if (!dataSetId) return;
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
  }, [dataSetId]);

  const table = useMemo(() => (preview ? parseCsvToTable(preview.csv) : null), [preview]);

  if (!dataSetId) {
    return <p className="text-sm text-muted-foreground">从左侧选择一个数据集后可查看预览。</p>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {previewLoading ? (
        <p className="text-sm text-muted-foreground">加载预处理后的数据中…</p>
      ) : previewError ? (
        <Alert variant="destructive">
          <AlertTitle>预览失败</AlertTitle>
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      ) : table && table.headers.length > 0 ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full caption-bottom border-collapse text-sm text-card-foreground">
              <thead className="[&_tr]:border-b [&_tr]:border-border/80 [&_tr]:bg-muted/40 [&_tr]:transition-colors [&_tr:hover]:bg-muted/50">
                <tr className="border-b border-border/60 transition-colors">
                  {table.headers.map((h) => (
                    <th
                      key={h}
                      className="sticky top-0 z-10 h-10 min-w-24 max-w-56 truncate bg-muted/95 px-3 text-left align-middle font-mono text-xs font-medium whitespace-nowrap text-muted-foreground backdrop-blur-sm"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {table.rows.map((r, idx) => (
                  <tr key={idx} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                    {r.map((v, cellIdx) => (
                      <td
                        key={`${idx}:${cellIdx}`}
                        className="max-w-56 truncate px-3 py-2 font-mono text-xs align-middle whitespace-nowrap"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无预览数据。</p>
      )}
    </div>
  );
}
