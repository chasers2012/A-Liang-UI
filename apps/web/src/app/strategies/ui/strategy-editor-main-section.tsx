'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { listNodes } from '@/api';

import {
  WorkflowGraphCanvas,
  WorkflowNodeTypeList,
  type WorkflowGraphCanvasHandle,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { NodeSummaryPublic } from '@/models/nodes/dto';

export function StrategyWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
}) {
  const { workflow, canvasKey, canvasRef, className } = props;
  const [catalog, setCatalog] = useState<NodeSummaryPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listNodes('strategy')
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      <Label>策略工作流</Label>
      {loading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <WorkflowNodeTypeList
            className="w-[300px]"
            items={nodeTypes}
            onSelectType={(type) => canvasRef.current?.addNode(type)}
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
