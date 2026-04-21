'use client';

import { CsvVirtualGrid } from './csv-virtual-grid';
import type { BacktestNodeOutputFile } from '@/models/backtest/dto';
import type { WorkflowSocketDefinition } from '@/components/workflow-graph/types';

function isCsvOutputFile(file: BacktestNodeOutputFile): boolean {
  return file.kind === 'csv' || (file.kind === 'text' && file.name.toLowerCase().endsWith('.csv'));
}

function getSocketNameFromFile(file: BacktestNodeOutputFile): string {
  return file.name.replace(/\.[^.]+$/, '');
}

function getSocketLabelForFile(file: BacktestNodeOutputFile, nodeOutputs: WorkflowSocketDefinition[]): string {
  const socketName = getSocketNameFromFile(file);
  const matched = nodeOutputs.find((socket) => socket.name === socketName);
  return matched?.label?.trim() || socketName;
}

export function NodeOutputFilesList({
  runId,
  nodeId,
  files,
  nodeOutputs,
}: {
  runId: string;
  nodeId: string;
  files: BacktestNodeOutputFile[];
  nodeOutputs: WorkflowSocketDefinition[];
}) {
  return (
    <>
      {files.map((file) => (
        <div key={file.name} className="rounded-md border bg-muted/20 p-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {getSocketLabelForFile(file, nodeOutputs)}
          </div>
          {isCsvOutputFile(file) ? (
            <CsvVirtualGrid runId={runId} nodeId={nodeId} fileName={file.name} />
          ) : (
            <pre className="max-h-72 overflow-auto rounded bg-background p-2 text-xs">
              {file.kind === 'json' ? JSON.stringify(file.content, null, 2) : String(file.content ?? '')}
            </pre>
          )}
        </div>
      ))}
    </>
  );
}

export { isCsvOutputFile };
