'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { deleteNode } from '@/api/nodes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditablePageTitle } from '@/components/editable-page-title';
import {
  cancelNodesDetailEditAtomFamily,
  getNodesDetailStateKey,
  loadNodesDetailPanelAtomFamily,
  NEW_NODE_DETAIL_KEY,
  nodesDetailPanelStateAtomFamily,
  saveNodesDetailAtomFamily,
  setNodesDetailEditDescriptionAtomFamily,
  setNodesDetailEditNameAtomFamily,
  setNodesDetailSourceDraftAtomFamily,
  startNodesDetailEditAtomFamily,
} from '@/models/nodes/detail.atom';
import { refreshNodesListAtom } from '@/models/nodes/list-detail.atom';
import { NodeDetailEditToolbarButton } from './panel-edit-toolbar-button';
import { PanelPreviewTab } from './panel-preview-tab';
import { PanelSourceTab } from './panel-source-tab';

export type NodesNodeDetailPanelProps = {
  nodeId?: string | null;
  createMode?: boolean;
};

// eslint-disable-next-line complexity
export function NodesNodeDetailPanel({ nodeId = null, createMode = false }: NodesNodeDetailPanelProps) {
  const effectiveNodeId = createMode ? NEW_NODE_DETAIL_KEY : nodeId;
  const stateKey = getNodesDetailStateKey(effectiveNodeId);
  const router = useRouter();
  const { detail, editName, editDescription, editing, saveError, saving, sourceDraft, loadError } = useAtomValue(
    nodesDetailPanelStateAtomFamily(stateKey),
  );
  const loadDetail = useSetAtom(loadNodesDetailPanelAtomFamily(stateKey));
  const startEdit = useSetAtom(startNodesDetailEditAtomFamily(stateKey));
  const cancelEdit = useSetAtom(cancelNodesDetailEditAtomFamily(stateKey));
  const setEditName = useSetAtom(setNodesDetailEditNameAtomFamily(stateKey));
  const setEditDescription = useSetAtom(setNodesDetailEditDescriptionAtomFamily(stateKey));
  const setSourceDraft = useSetAtom(setNodesDetailSourceDraftAtomFamily(stateKey));
  const saveDetail = useSetAtom(saveNodesDetailAtomFamily(stateKey));
  const refreshNodesList = useSetAtom(refreshNodesListAtom);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isCreate = effectiveNodeId === NEW_NODE_DETAIL_KEY;
  const isPluginNode = detail?.is_plugin === true;
  const canEdit = detail != null && !isPluginNode;
  const canDelete = !isCreate && detail != null;
  const editActive = canEdit && editing;

  const handleSaveSource = async () => {
    const saved = await saveDetail();
    if (isCreate && saved) router.push(`/nodes?id=${encodeURIComponent(saved.id)}`);
  };
  const handleCancelEdit = () => {
    if (isCreate) return void router.push('/nodes');
    cancelEdit();
  };
  const handleDeleteNode = async () => {
    if (!canDelete || isPluginNode || deleting) return;
    setDeleting(true);
    try {
      await deleteNode(detail.id);
      await refreshNodesList();
      router.push('/nodes');
    } finally {
      setDeleting(false);
    }
  };

  if (effectiveNodeId && loadError) {
    return (
      <>
        <CardHeader className="shrink-0">
          <CardTitle>节点</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </CardContent>
      </>
    );
  }

  const placeholder = !effectiveNodeId ? '请从左侧选择一个节点。' : '加载中…';

  return (
    <>
      <CardHeader className="shrink-0 space-y-2">
        <CardTitle className="space-y-2">
          <EditablePageTitle
            value={editName}
            showEdit={editActive && canEdit}
            onChange={setEditName}
            inputAriaLabel="节点名称"
            placeholder="节点详情"
            editButtonAriaLabel="编辑名称"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs key={effectiveNodeId ?? 'none'} defaultValue="preview" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0">
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger value="preview">预览</TabsTrigger>
              <TabsTrigger value="source">源码</TabsTrigger>
            </TabsList>
            <NodeDetailEditToolbarButton
              canEdit={detail != null}
              editDisabled={isPluginNode}
              editing={editing}
              saving={editActive ? saving : false}
              saveDisabled={editActive ? !editName.trim() : true}
              onStartEdit={startEdit}
              onCancelEdit={handleCancelEdit}
              onSave={editActive ? () => void handleSaveSource() : undefined}
              onDelete={canDelete ? () => void handleDeleteNode() : undefined}
              deleteDisabled={deleting || isPluginNode}
            />
          </div>
          <TabsContent value="preview">
            <PanelPreviewTab
              detail={detail}
              placeholder={placeholder}
              editable={editActive}
              editName={editName}
              editDescription={editDescription}
              onEditDescriptionChange={setEditDescription}
            />
          </TabsContent>
          <TabsContent value="source">
            <PanelSourceTab
              detail={detail}
              placeholder={placeholder}
              editable={editActive}
              editName={editName}
              sourceDraft={sourceDraft}
              onSourceDraftChange={editActive ? setSourceDraft : undefined}
              saveError={editActive ? saveError : null}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );
}
