'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { Page } from '@/components/page';
import {
  cancelDataSyncFormAtom,
  dataSyncAutoSelectEffectAtom,
  dataSyncEditActiveAtom,
  dataSyncListRefreshOnMountEffectAtom,
  dataSyncShowEditorAtom,
  dataSyncSyncViewFormEffectAtom,
  dataSyncWorkflowBoundaryEffectAtom,
} from '@/models/data-sync/panel.atom';

import { DataSyncDetailPane } from './data-sync-detail-pane';
import { DataSyncListPane } from './data-sync-list-pane';

export function DataSyncPage() {
  useAtom(dataSyncListRefreshOnMountEffectAtom);
  useAtom(dataSyncAutoSelectEffectAtom);
  useAtom(dataSyncSyncViewFormEffectAtom);
  useAtom(dataSyncWorkflowBoundaryEffectAtom);

  const sidebarCollapsed = useAtomValue(dataSyncShowEditorAtom);
  const cancelForm = useSetAtom(cancelDataSyncFormAtom);

  useNavigationEditGuard(dataSyncEditActiveAtom, {
    onAbandon: () => cancelForm(),
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={sidebarCollapsed} innerWidthClassName="w-[320px]">
        <DataSyncListPane />
      </CollapsibleSearchListSidebar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSyncDetailPane />
      </div>
    </Page>
  );
}
