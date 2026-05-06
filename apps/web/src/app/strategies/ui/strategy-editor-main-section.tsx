'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useSetAtom } from 'jotai';

import { cn } from '@/lib/utils';
import { getNode, getNodesDetailBatch, listNodes } from '@/api/nodes';

import {
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  toWorkflowNodeType,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { NodeSummaryPublic } from '@/models/nodes/dto';
import { SearchList } from '@/components/search-list';
import { refreshNodesByDomainAtomFamily } from '@/models/nodes/list-detail.atom';

export function StrategyWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
}) {
  const { workflow, canvasKey, canvasRef, className } = props;
  const [catalog, setCatalog] = useState<NodeSummaryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshStrategyNodes = useSetAtom(refreshNodesByDomainAtomFamily('strategy'));

  useEffect(() => {
    void listNodes('strategy')
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-hidden', className)}>
      {loading ? (
        <p className="text-sm text-muted-foreground">正在加载策略节点…</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <SearchList
            className="h-full max-h-full w-[300px] shrink-0 overflow-y-auto"
            items={nodeTypes}
            title="策略节点"
            searchPlaceholder="搜索节点/描述"
            getGroupKey={(item) => item.category ?? '未分类'}
            renderTitle={(item) => item.label}
            renderDescription={(item) => item.description ?? ''}
            getSearchText={(item) => [item.label, item.description ?? '', item.category ?? ''].join(' ')}
            onItemSelected={(item) => canvasRef.current?.addNode(item.id)}
            onItemDrag={(item, e) => {
              e.dataTransfer.setData(WORKFLOW_GRAPH_NODE_DRAG_MIME, item.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          />
          <WorkflowGraphCanvas
            key={canvasKey}
            ref={canvasRef}
            nodeTypes={nodeTypes}
            initialGraph={workflow}
            resolveNodeTypeDefinition={async (typeKey) => toWorkflowNodeType(await getNode(typeKey))}
            resolveNodeTypeDefinitions={async (typeKeys) =>
              (await getNodesDetailBatch(typeKeys)).map((detail) => toWorkflowNodeType(detail))
            }
            onRefreshNodeDefinitions={async () => toWorkflowNodeTypes(await refreshStrategyNodes())}
            className="h-full flex-1 min-w-0"
          />
        </div>
      )}
    </div>
  );
}
