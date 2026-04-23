'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditablePageTitle } from '@/components/editable-page-title';
import {
  factorsDetailErrorAtom,
  factorsDetailLoadingAtom,
  factorsEditNameAtom,
  factorsEditingAtom,
  factorsVisibleDetailAtom,
  factorsSelectedIdAtom,
} from '@/models/factor';
import { PanelOverviewTab } from './panel-overview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { FactorDetailToolbarButton } from './panel-edit-toolbar-button';

function FactorDetailPanelContent() {
  const selectedId = useAtomValue(factorsSelectedIdAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const loading = useAtomValue(factorsDetailLoadingAtom) && selectedId != null;
  const loadError = useAtomValue(factorsDetailErrorAtom);

  if (!selectedId && !editing) {
    return (
      <Alert>
        <AlertDescription>请选择左侧因子后查看详情。</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Alert>
        <AlertDescription>详情加载中…</AlertDescription>
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>详情加载失败：{String(loadError)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <TabsContent value="overview">
        <PanelOverviewTab />
      </TabsContent>
      <TabsContent value="source">
        <PanelSourceTab />
      </TabsContent>
    </>
  );
}

export function FactorDetailPanel() {
  const setEditName = useSetAtom(factorsEditNameAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const detail = useAtomValue(factorsVisibleDetailAtom);

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-2">
        <CardTitle className="space-y-2">
          <EditablePageTitle
            showEdit={editing}
            value={detail?.name ?? ''}
            onChange={(name) => {
              setEditName(name);
            }}
            inputAriaLabel="编辑因子标识 name"
            editButtonAriaLabel="编辑因子标识 name"
            placeholder="（未命名因子）"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex h-[48px] w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0">
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="source">源码</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <FactorDetailToolbarButton />
            </div>
          </div>
          <div className="h-full max-h-[calc(100vh-10rem)] flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-2">
            <FactorDetailPanelContent />
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
