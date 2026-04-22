'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';

import { cn } from '@/lib/utils';

import {
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { NodeSummaryPublic } from '@/models/nodes/dto';
import { listNodes } from '@/api/nodes';
import { SearchList } from '@/components/search-list';

export function PreprocessingWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
}) {
  const { workflow, canvasKey, canvasRef, className } = props;

  const [catalog, setCatalog] = useState<NodeSummaryPublic[]>([]);
  const [wfMetaLoading, setWfMetaLoading] = useState(true);

  useEffect(() => {
    listNodes('preprocessors')
      .then(setCatalog)
      .catch(() => {
        // Ignore, UI falls back to empty sidebar.
      })
      .finally(() => setWfMetaLoading(false));
  }, []);

  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col gap-3', className)}>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : (
        <div className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <SearchList
            items={nodeTypes}
            className="w-[300px]"
            title="节点列表"
            searchPlaceholder="搜索名称/描述"
            getGroupKey={(item) => item.category ?? '其他'}
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
            className="h-full flex-1"
          />
        </div>
      )}
    </div>
  );
}
