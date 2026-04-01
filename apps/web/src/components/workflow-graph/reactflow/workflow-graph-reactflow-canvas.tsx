"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import type {
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "../workflow-graph-canvas-types";
import { catalogToMap } from "../graph-model";
import { WorkflowStepNode } from "./nodes";
import {
  EMPTY_WORKFLOW_GRAPH_JSON,
  parsePersistedWorkflowGraphJson,
  persistedViewportToReactFlowViewport,
  stringifyPersistedWorkflowGraph,
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
} from "./serialize";

type WorkflowGraphZoomApi = {
  zoomBy: (factor: number) => void;
  fitView: () => void;
};

function WorkflowGraphReactFlowInner({
  readOnly,
  zoomApiRef,
}: {
  readOnly: boolean;
  zoomApiRef: React.MutableRefObject<WorkflowGraphZoomApi | null>;
}) {
  const rf = useReactFlow();

  useEffect(() => {
    zoomApiRef.current = {
      zoomBy: (factor: number) => {
        const vp = rf.getViewport();
        const next = Math.max(0.05, Math.min(8, vp.zoom * factor));
        rf.setViewport({ ...vp, zoom: next }, { duration: 120 });
      },
      fitView: () => {
        rf.fitView({ padding: 0.18, duration: 200 });
      },
    };
    return () => {
      zoomApiRef.current = null;
    };
  }, [rf, zoomApiRef]);

  useEffect(() => {
    rf.setInteractive(!readOnly);
  }, [readOnly, rf]);

  return null;
}

export const WorkflowGraph = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(function WorkflowGraph(
  {
    className,
    canvasAreaClassName,
    nodeTypes,
    initialGraphJson,
    readOnly = false,
    children,
  },
  ref,
) {
  const catalog = useMemo(() => catalogToMap(nodeTypes), [nodeTypes]);
  const parsed = useMemo(
    () => parsePersistedWorkflowGraphJson(initialGraphJson),
    [initialGraphJson],
  );

  const initialNodes = useMemo(() => toReactFlowNodes(parsed, catalog), [parsed, catalog]);
  const initialEdges = useMemo(() => toReactFlowEdges(parsed), [parsed]);
  const initialViewport = useMemo(
    () => persistedViewportToReactFlowViewport(parsed.viewport),
    [parsed.viewport],
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [viewport, setViewport] = useState<Viewport | null>(
    initialViewport ?? null,
  );

  const zoomApiRef = useRef<WorkflowGraphZoomApi | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges]);
  useEffect(() => {
    setViewport(initialViewport ?? null);
  }, [initialViewport]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect: OnConnect = useCallback((c: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...c,
          id: crypto.randomUUID(),
          type: "default",
        },
        eds,
      ),
    );
  }, []);

  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      setViewport(vp);
    },
    [],
  );

  const getGraphJson = useCallback((): string => {
    const ser = toPersistedWorkflowGraph(nodes, edges, viewport);
    return stringifyPersistedWorkflowGraph(ser);
  }, [nodes, edges, viewport]);

  const importGraphJson = useCallback(
    (json: string) => {
      const g = parsePersistedWorkflowGraphJson(
        json.trim() ? json : EMPTY_WORKFLOW_GRAPH_JSON,
      );
      setNodes(toReactFlowNodes(g, catalog));
      setEdges(toReactFlowEdges(g));
      const vp = persistedViewportToReactFlowViewport(g.viewport) ?? null;
      setViewport(vp);
    },
    [catalog],
  );

  useImperativeHandle(ref, () => ({ getGraphJson, importGraphJson }), [
    getGraphJson,
    importGraphJson,
  ]);

  const nodeTypesMap = useMemo(() => ({ workflowStep: WorkflowStepNode }), []);

  return (
    <div
      data-slot="workflow-graph-layout"
      className={cn("flex min-h-[320px] flex-col gap-3", className)}
    >
      <div
        className={cn(
          "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40",
          readOnly && "workflow-graph-canvas-root--readonly",
          canvasAreaClassName,
        )}
      >
        <div className="relative min-h-[280px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypesMap}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            onMoveEnd={onMoveEnd}
            defaultViewport={initialViewport}
            fitView={!initialViewport}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            zoomOnScroll={!readOnly}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <WorkflowGraphReactFlowInner readOnly={readOnly} zoomApiRef={zoomApiRef} />
            <Background
              id="workflow-graph-bg"
              gap={22}
              size={1}
              variant={BackgroundVariant.Dots}
              className="opacity-60"
            />
            <Controls showInteractive={false} />
          </ReactFlow>

          {children}
        </div>
      </div>
    </div>
  );
});

