'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  type WorkflowNodeTypeDefinition,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { getAgentWorkflow, patchAgentWorkflow } from '@/api/agent-workflows';
import { listNodes } from '@/api/nodes';
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { EMPTY_WORKFLOW } from '@/components/workflow-graph/reactflow/serialize';

export interface AgentWorkflowCanvasCardProps {
  workflowId: string | null;
}

export function AgentWorkflowCanvasCard({ workflowId }: AgentWorkflowCanvasCardProps) {
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);
  const [nodeTypes, setNodeTypes] = useState<WorkflowNodeTypeDefinition[]>([]);
  const [graph, setGraph] = useState<WorkflowGraphPersisted>(EMPTY_WORKFLOW);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    listNodes('agent-workflow')
      .then((catalog) => setNodeTypes(toWorkflowNodeTypes(catalog)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workflowId) {
      setGraph(EMPTY_WORKFLOW);
      setName('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAgentWorkflow(workflowId)
      .then((detail) => {
        if (cancelled) return;
        setName(detail.name);
        setGraph(detail.graph ?? EMPTY_WORKFLOW);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const handleSave = useCallback(async () => {
    if (!workflowId || !canvasRef.current) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const currentGraph = canvasRef.current.getGraph();
      await patchAgentWorkflow(workflowId, { graph: currentGraph });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [workflowId]);

  if (!workflowId) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">选择左侧 Agent 以编辑工作流</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">加载中…</div>
      </Card>
    );
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden" size="sm">
      <CardHeader>
        <CardTitle>{name || '工作流'}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void handleSave()}>
            <Save className="size-3.5" data-icon="inline-start" />
            {saving ? '保存中…' : saveOk ? '已保存' : '保存'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {nodeTypes.length > 0 && (
          <WorkflowGraphCanvas
            key={workflowId}
            ref={canvasRef}
            nodeTypes={nodeTypes}
            initialGraph={graph}
            className="h-full"
          />
        )}
      </CardContent>
    </Card>
  );
}
