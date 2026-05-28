'use client';

import { useEffect, useMemo, type WheelEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type FitViewOptions,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '@/lib/utils';
import { WorkflowGraphFitViewButton } from '@/components/workflow-graph/workflow-graph-fit-view-button';
import { WorkflowGraphContextProvider } from '@/components/workflow-graph/workflow-graph-context';
import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from '@/components/workflow-graph/reactflow/workflow-graph-reactflow-defaults';
import type { WorkflowStepNodeData } from '@/components/workflow-graph/reactflow/node/nodes';
import type { WorkflowNodeInputSpec, WorkflowSocketDefinition } from '@/components/workflow-graph/types';

const PREVIEW_NODE_ID = 'workflow-node-preview';
const PREVIEW_FIT_VIEW: FitViewOptions = {
  padding: 0.32,
  duration: 220,
  maxZoom: 1.45,
  minZoom: 0.12,
  includeHiddenNodes: false,
  nodes: [{ id: PREVIEW_NODE_ID }],
};

function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null;
  while (el) {
    const { overflowY, overflowX } = getComputedStyle(el);
    const canScrollY =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      el.scrollHeight > el.clientHeight + 1;
    const canScrollX =
      (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
      el.scrollWidth > el.clientWidth + 1;
    if (canScrollY || canScrollX) return el;
    el = el.parentElement;
  }
  return null;
}

function handlePreviewWheelCapture(event: WheelEvent<HTMLDivElement>) {
  const scrollParent = findScrollableAncestor(event.currentTarget);
  if (!scrollParent) return;
  if (event.deltaY !== 0) scrollParent.scrollTop += event.deltaY;
  if (event.deltaX !== 0) scrollParent.scrollLeft += event.deltaX;
  event.preventDefault();
  event.stopPropagation();
}

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

function PreviewFitViewToolbar() {
  return (
    <Panel position="bottom-left" className="m-3!">
      <div
        data-slot="workflow-graph-zoom"
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md"
      >
        <WorkflowGraphFitViewButton fitViewOptions={PREVIEW_FIT_VIEW} />
      </div>
    </Panel>
  );
}

function Flow(props: WorkflowStepNodePreviewProps) {
  const { label, description, inputs, outputs, params = {}, selected = true } = props;
  const nodeData: WorkflowStepNodeData = useMemo(
    () => ({
      backendType: 'preview',
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
      type: 'workflowStep',
      position: { x: 0, y: 0 },
      selected,
      data: nodeData,
    }),
    [nodeData, selected],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowStepNodeData>([nextNode]);
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
      preventScrolling={false}
      proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
      className="h-full min-h-0 w-full bg-transparent!"
    >
      <PreviewFitViewOnReady fitKey={fitKey} />
      <PreviewFitViewToolbar />
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
        'workflow-step-node-preview relative h-[min(400px,55vh)] w-full min-h-[200px] overflow-hidden rounded-lg border border-dashed border-border/60 bg-muted/15',
        '[&_.react-flow__pane]:pointer-events-none [&_.react-flow__panel]:pointer-events-auto',
        className,
      )}
      onWheelCapture={handlePreviewWheelCapture}
    >
      <ReactFlowProvider>
        <WorkflowGraphContextProvider readOnly>
          <Flow {...rest} />
        </WorkflowGraphContextProvider>
      </ReactFlowProvider>
    </div>
  );
}
