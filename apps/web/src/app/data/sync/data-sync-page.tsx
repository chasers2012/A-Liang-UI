'use client';

import { useRef } from 'react';

import { Page } from '@/components/page';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import { useDataSyncPage } from '@/models/data-sync/use-data-sync-page';

import { DataSyncDetailPane } from './data-sync-detail-pane';
import { DataSyncListPane } from './data-sync-list-pane';

export function DataSyncPage() {
  const workflowCanvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);
  const { listPane, detailPane } = useDataSyncPage(workflowCanvasRef);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <DataSyncListPane {...listPane} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSyncDetailPane {...detailPane} />
      </div>
    </Page>
  );
}
