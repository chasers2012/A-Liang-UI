'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { Page } from '@/components/page';
import {
  cancelFormAtom,
  autoSelectEffectAtom,
  isEditingAtom,
  listRefreshOnMountEffectAtom,
  syncViewFormEffectAtom,
  workflowBoundaryEffectAtom,
} from '@/models/data-sync/panel.atom';

import { DataSyncDetailPane } from './data-sync-detail-pane';
import { DataSyncListPane } from './data-sync-list-pane';

export function DataSyncPage() {
  useAtom(listRefreshOnMountEffectAtom);
  useAtom(autoSelectEffectAtom);
  useAtom(syncViewFormEffectAtom);
  useAtom(workflowBoundaryEffectAtom);

  const sidebarCollapsed = useAtomValue(isEditingAtom);
  const cancelForm = useSetAtom(cancelFormAtom);

  useNavigationEditGuard(isEditingAtom, {
    onAbandon: () => cancelForm(),
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={sidebarCollapsed} innerWidthClassName="w-[320px]">
        <DataSyncListPane />
      </CollapsibleSearchListSidebar>
      <DataSyncDetailPane />
    </Page>
  );
}
