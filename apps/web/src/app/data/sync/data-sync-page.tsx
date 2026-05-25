'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { Page } from '@/components/page';
import {
  cancelFormAtom,
  autoSelectEffectAtom,
  isEditingAtom,
  listRefreshOnMountEffectAtom,
  refreshPageAtom,
  syncViewFormEffectAtom,
  workflowBoundaryEffectAtom,
} from '@/models/data-sync/panel.atom';
import { useDataSyncTaskEvents } from '@/models/data-sync/use-data-sync-events';

import { DataSyncDetailPane } from './data-sync-detail-pane';
import { DataSyncListPane } from './data-sync-list-pane';

export function DataSyncPage() {
  useAtom(listRefreshOnMountEffectAtom);
  useAtom(autoSelectEffectAtom);
  useAtom(syncViewFormEffectAtom);
  useAtom(workflowBoundaryEffectAtom);

  const refreshPage = useSetAtom(refreshPageAtom);
  useDataSyncTaskEvents(refreshPage);

  const sidebarCollapsed = useAtomValue(isEditingAtom);
  const cancelForm = useSetAtom(cancelFormAtom);

  useNavigationEditGuard(isEditingAtom, {
    onAbandon: () => cancelForm(),
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSidebar collapsed={sidebarCollapsed} drawerTitle="同步任务">
        <DataSyncListPane />
      </CollapsibleSidebar>
      <DataSyncDetailPane />
    </Page>
  );
}
