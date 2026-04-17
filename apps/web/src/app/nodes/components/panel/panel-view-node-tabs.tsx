'use client';

import { useState } from 'react';

import { useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';

import { deleteNode } from '@/api/nodes';
import { CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  cancelNodesDetailEditAtomFamily,
  NEW_NODE_DETAIL_KEY,
  nodesDetailPanelStateAtomFamily,
  saveNodesDetailAtomFamily,
  setNodesDetailEditDescriptionAtomFamily,
  setNodesDetailEditNameAtomFamily,
  setNodesDetailSourceDraftAtomFamily,
  startNodesDetailEditAtomFamily,
} from '@/models/nodes/detail.atom';
import { refreshNodesListAtom } from '@/models/nodes/list-detail.atom';
import { NodeDetailCardHeader } from './panel-header';
import { NodeDetailEditToolbarButton } from './panel-edit-toolbar-button';
import { PanelPreviewTab } from './panel-preview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { NODE_PAGE_CARD_TOOLBAR, TAB_TRIGGER_CLASS } from './shared';

export function PanelViewNodeTabs(props: { stateKey: string; effectiveNodeId: string | null; placeholder: string }) {
  const { stateKey, placeholder, effectiveNodeId } = props;
  const router = useRouter();
  const { detail, editName, editDescription, editing, saveError, saving, sourceDraft } = useAtomValue(
    nodesDetailPanelStateAtomFamily(stateKey),
  );
  const startEdit = useSetAtom(startNodesDetailEditAtomFamily(stateKey));
  const cancelEdit = useSetAtom(cancelNodesDetailEditAtomFamily(stateKey));
  const setEditName = useSetAtom(setNodesDetailEditNameAtomFamily(stateKey));
  const setEditDescription = useSetAtom(setNodesDetailEditDescriptionAtomFamily(stateKey));
  const setSourceDraft = useSetAtom(setNodesDetailSourceDraftAtomFamily(stateKey));
  const saveDetail = useSetAtom(saveNodesDetailAtomFamily(stateKey));
  const refreshNodesList = useSetAtom(refreshNodesListAtom);
  const [deleting, setDeleting] = useState(false);

  const isCreate = effectiveNodeId === NEW_NODE_DETAIL_KEY;
  const isPluginNode = detail?.is_plugin === true;
  const canEdit = detail != null && !isPluginNode;
  const canDelete = !isCreate && detail != null;
  const editActive = canEdit && editing;

  const handleSaveSource = async () => {
    const saved = await saveDetail();
    if (isCreate && saved) router.push(`/nodes/${encodeURIComponent(saved.id)}`);
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

  return (
    <>
      <NodeDetailCardHeader
        editActive={editActive}
        canEdit={canEdit}
        editName={editName}
        onEditNameChange={setEditName}
        detail={detail}
        effectiveNodeId={effectiveNodeId}
      />
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs key={effectiveNodeId ?? 'none'} defaultValue="preview" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className={NODE_PAGE_CARD_TOOLBAR}>
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger value="preview" className={TAB_TRIGGER_CLASS}>
                预览
              </TabsTrigger>
              <TabsTrigger value="source" className={TAB_TRIGGER_CLASS}>
                源码
              </TabsTrigger>
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
          <TabsContent
            value="preview"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-hidden:hidden"
          >
            <PanelPreviewTab
              detail={detail}
              placeholder={placeholder}
              editable={editActive}
              editName={editName}
              editDescription={editDescription}
              onEditDescriptionChange={setEditDescription}
            />
          </TabsContent>
          <TabsContent
            value="source"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-hidden:hidden"
          >
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
