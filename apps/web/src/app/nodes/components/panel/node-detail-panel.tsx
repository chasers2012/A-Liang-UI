'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import { nodesDetailAsyncStateAtomFamily } from '@/models/nodes/detail.atom';
import { NodeDetailEditToolbarButton } from './panel-edit-toolbar-button';
import { PanelPreviewTab } from './panel-preview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';
import { nodesEditActiveAtom, nodesEditNameAtom, nodesVisibleDetailAtom } from '@/models/nodes/edit.atom';

export function NodesNodeDetailPanel() {
  const editActive = useAtomValue(nodesEditActiveAtom);
  const visibleDetail = useAtomValue(nodesVisibleDetailAtom);
  const setEditName = useSetAtom(nodesEditNameAtom);
  const selectedId = useAtomValue(nodesSelectedIdAtom);
  const detailState = useAtomValue(nodesDetailAsyncStateAtomFamily(selectedId));
  const visibleName = (visibleDetail?.name ?? '').toString();

  const showStatus = (detailState.loading && selectedId) || (selectedId && detailState.error);
  const status =
    detailState.loading && selectedId ? (
      <div className="flex min-h-0 flex-1 flex-col">加载中…</div>
    ) : selectedId && detailState.error ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{detailState.error}</AlertDescription>
        </Alert>
      </div>
    ) : null;

  return (
    <PanelDetailCard
      title={
        <EditablePageTitle
          value={visibleName}
          showEdit={editActive}
          onChange={(v) => setEditName(v)}
          inputAriaLabel="节点名称"
          placeholder="节点详情"
          editButtonAriaLabel="编辑名称"
        />
      }
      panels={
        showStatus
          ? [
              { value: 'preview', label: '预览', content: status },
              { value: 'source', label: '源码', content: status },
            ]
          : [
              {
                value: 'preview',
                label: '预览',
                content: (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <PanelPreviewTab />
                  </div>
                ),
              },
              {
                value: 'source',
                label: '源码',
                content: (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <PanelSourceTab />
                  </div>
                ),
              },
            ]
      }
      actions={<NodeDetailEditToolbarButton />}
    />
  );
}
