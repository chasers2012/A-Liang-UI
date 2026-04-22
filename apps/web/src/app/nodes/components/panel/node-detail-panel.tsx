'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getNodesDetailStateKey,
  loadNodesDetailPanelAtomFamily,
  NEW_NODE_DETAIL_KEY,
  nodesDetailPanelStateAtomFamily,
} from '@/models/nodes/detail.atom';
import { EMPTY_HINT } from './shared';
import { PanelViewNodeTabs } from './panel-view-node-tabs';

export type NodesNodeDetailPanelProps = {
  nodeId?: string | null;
  createMode?: boolean;
};

export function NodesNodeDetailPanel({ nodeId = null, createMode = false }: NodesNodeDetailPanelProps) {
  const effectiveNodeId = createMode ? NEW_NODE_DETAIL_KEY : nodeId;
  const stateKey = getNodesDetailStateKey(effectiveNodeId);
  const { detail, loadError } = useAtomValue(nodesDetailPanelStateAtomFamily(stateKey));
  const loadDetail = useSetAtom(loadNodesDetailPanelAtomFamily(stateKey));

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

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

  const placeholder = !effectiveNodeId ? EMPTY_HINT : '加载中…';
  const tabsInstanceKey = `${effectiveNodeId ?? 'none'}:${detail?.id ?? 'pending'}`;
  return (
    <PanelViewNodeTabs
      key={tabsInstanceKey}
      stateKey={stateKey}
      effectiveNodeId={effectiveNodeId}
      placeholder={placeholder}
    />
  );
}
