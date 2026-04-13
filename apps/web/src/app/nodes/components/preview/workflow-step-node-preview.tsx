"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type FitViewOptions,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { cn } from "@/lib/utils";
import { WorkflowGraphContextProvider } from "@/components/workflow-graph/workflow-graph-context";
import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from "@/components/workflow-graph/reactflow/workflow-graph-reactflow-defaults";
import type { WorkflowStepNodeData } from "@/components/workflow-graph/reactflow/node/nodes";
import type {
  WorkflowNodeInputSpec,
  WorkflowSocketDefinition,
} from "@/components/workflow-graph/types";

const PREVIEW_NODE_ID = "workflow-node-preview";
const PREVIEW_FIT_VIEW: FitViewOptions = {
  padding: 0.32,
  duration: 220,
  maxZoom: 1.45,
  minZoom: 0.12,
  includeHiddenNodes: false,
  nodes: [{ id: PREVIEW_NODE_ID }],
};

export type WorkflowStepNodePreviewProps = {
  label: string;
  description?: string | null;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
  params?: Record<string, unknown>;
  selected?: boolean;
  className?: string;
};

function PreviewFitViewOnReady({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (!nodesInitialized) return;
    let cancelled = false;
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => !cancelled && fitView(PREVIEW_FIT_VIEW));
      if (cancelled) cancelAnimationFrame(id2);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
    };
  }, [fitView, fitKey, nodesInitialized]);
  return null;
}

function Flow(props: WorkflowStepNodePreviewProps) {
  const { label, description, inputs, outputs, params = {}, selected = true } = props;
  const nodeData: WorkflowStepNodeData = useMemo(
    () => ({
      backendType: "preview",
      label,
      description: description?.trim() ? description.trim() : undefined,
      inputs,
      outputs,
      params,
    }),
    [label, description, inputs, outputs, params],
  );
  const nextNode: Node<WorkflowStepNodeData> = useMemo(
    () => ({
      id: PREVIEW_NODE_ID,
      type: "workflowStep",
      position: { x: 0, y: 0 },
      selected,
      data: nodeData,
    }),
    [nodeData, selected],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowStepNodeData>([
    nextNode,
  ]);
  const fitKey = useMemo(
    () => JSON.stringify({ label, description, inputs, outputs, params, selected }),
    [label, description, inputs, outputs, params, selected],
  );
  useEffect(() => setNodes([nextNode]), [nextNode, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={[]}
      nodeTypes={WORKFLOW_GRAPH_RF_NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      panOnDrag={false}
      panOnScroll={false}
      preventScrolling
      proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
      className="h-full min-h-0 w-full bg-transparent!"
    >
      <PreviewFitViewOnReady fitKey={fitKey} />
      <Background
        id="workflow-node-preview-bg"
        gap={22}
        size={1}
        variant={BackgroundVariant.Dots}
        className="opacity-60"
      />
    </ReactFlow>
  );
}

export function WorkflowStepNodePreview(props: WorkflowStepNodePreviewProps) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn(
        "workflow-step-node-preview relative h-[min(400px,55vh)] w-full min-h-[200px] overflow-hidden rounded-lg border border-dashed border-border/60 bg-muted/15",
        className,
      )}
    >
      <ReactFlowProvider>
        <WorkflowGraphContextProvider readOnly>
          <Flow {...rest} />
        </WorkflowGraphContextProvider>
      </ReactFlowProvider>
    </div>
  );
}

