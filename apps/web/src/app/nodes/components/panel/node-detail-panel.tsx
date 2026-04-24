'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditablePageTitle } from '@/components/editable-page-title';
import { nodesDetailAsyncStateAtomFamily } from '@/models/nodes/detail.atom';
import { NodeDetailEditToolbarButton } from './panel-edit-toolbar-button';
import { PanelPreviewTab } from './panel-preview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';
import { nodesEditActiveAtom, nodesEditNameAtom, nodesVisibleDetailAtom } from '@/models/nodes/edit.atom';
import { cn } from '@/lib/utils';

function DetailPanelBody() {
  const selectedId = useAtomValue(nodesSelectedIdAtom);

  const detailState = useAtomValue(nodesDetailAsyncStateAtomFamily(selectedId));

  if (detailState.loading && selectedId) {
    return <div className="flex min-h-0 flex-1 flex-col">加载中…</div>;
  }

  if (selectedId && detailState.error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{detailState.error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <>
      <TabsContent value="preview" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        <PanelPreviewTab />
      </TabsContent>
      <TabsContent value="source" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        <PanelSourceTab />
      </TabsContent>
    </>
  );
}

export function NodesNodeDetailPanel() {
  const editActive = useAtomValue(nodesEditActiveAtom);
  const visibleDetail = useAtomValue(nodesVisibleDetailAtom);
  const setEditName = useSetAtom(nodesEditNameAtom);
  const selectedId = useAtomValue(nodesSelectedIdAtom);
  const visibleName = (visibleDetail?.name ?? '').toString();

  return (
    <>
      <CardHeader className="shrink-0 space-y-2">
        <CardTitle className="space-y-2">
          <EditablePageTitle
            value={visibleName}
            showEdit={editActive}
            onChange={(v) => setEditName(v)}
            inputAriaLabel="节点名称"
            placeholder="节点详情"
            editButtonAriaLabel="编辑名称"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs key={selectedId ?? 'none'} defaultValue="preview" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0 h-[48px] ">
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger value="preview">预览</TabsTrigger>
              <TabsTrigger value="source">源码</TabsTrigger>
            </TabsList>
            <NodeDetailEditToolbarButton />
          </div>
          <div
            className={cn(
              'h-full max-h-[calc(100vh-10rem)] px-6 pb-6 pt-2',
              'flex min-h-0 flex-1 flex-col overflow-hidden',
            )}
          >
            <DetailPanelBody />
          </div>
        </Tabs>
      </CardContent>
    </>
  );
}
