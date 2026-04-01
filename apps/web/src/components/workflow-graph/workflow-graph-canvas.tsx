"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { catalogToMap } from "./graph-model";
import type {
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "./workflow-graph-canvas-types";
import { WorkflowStepNode } from "./reactflow/nodes";
import {
  EMPTY_WORKFLOW_GRAPH_JSON,
  parsePersistedWorkflowGraphJson,
  persistedViewportToReactFlowViewport,
  stringifyPersistedWorkflowGraph,
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
} from "./reactflow/serialize";

import "./workflow-graph-canvas.css";

export type {
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "./workflow-graph-canvas-types";

export { WORKFLOW_GRAPH_NODE_DRAG_MIME } from "./workflow-graph-canvas-constants";

type WorkflowGraphZoomContextValue = {
  zoomBy: (factor: number) => void;
  zoomFit: () => void;
};

const WorkflowGraphZoomContext =
  createContext<WorkflowGraphZoomContextValue | null>(null);

function useWorkflowGraphZoom(): WorkflowGraphZoomContextValue {
  const ctx = useContext(WorkflowGraphZoomContext);
  if (!ctx) {
    throw new Error(
      "WorkflowGraphZoomToolbar must be used inside WorkflowGraphZoomContext provider",
    );
  }
  return ctx;
}

export function WorkflowGraphZoomToolbar() {
  const { zoomBy, zoomFit } = useWorkflowGraphZoom();
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-1">
      <div
        data-slot="workflow-graph-zoom"
        className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md backdrop-blur-md"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none border-b border-border"
          onClick={() => zoomBy(1.15)}
          aria-label="放大"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none border-b border-border"
          onClick={() => zoomBy(1 / 1.15)}
          aria-label="缩小"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none"
          onClick={zoomFit}
          aria-label="适应画布"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

type ZoomApi = {
  zoomBy: (factor: number) => void;
  fitView: () => void;
};

function ReactFlowZoomBridge({
  zoomApiRef,
}: {
  zoomApiRef: React.MutableRefObject<ZoomApi | null>;
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

  return null;
}

export const WorkflowGraphCanvas = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(
  function WorkflowGraphCanvas(
    { className, canvasAreaClassName, nodeTypes, initialGraphJson, readOnly = false, children },
    ref,
  ) {
    const catalog = useMemo(() => catalogToMap(nodeTypes), [nodeTypes]);
    const parsed = useMemo(
      () => parsePersistedWorkflowGraphJson(initialGraphJson),
      [initialGraphJson],
    );
    const initialNodes = useMemo(
      () => toReactFlowNodes(parsed, catalog),
      [parsed, catalog],
    );
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

    const zoomApiRef = useRef<ZoomApi | null>(null);

    useEffect(() => {
      setNodes(initialNodes);
    }, [initialNodes]);
    useEffect(() => {
      setEdges(initialEdges);
    }, [initialEdges]);
    useEffect(() => {
      setViewport(initialViewport ?? null);
    }, [initialViewport]);

    const onNodesChange = (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    };

    const onEdgesChange = (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    };

    const onConnect: OnConnect = (c: Connection) => {
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
    };

    const onMoveEnd = (_: unknown, vp: Viewport) => {
      setViewport(vp);
    };

    const zoomBy = (factor: number) => zoomApiRef.current?.zoomBy(factor);
    const zoomFit = () => zoomApiRef.current?.fitView();

    const getGraphJson = () => {
      const ser = toPersistedWorkflowGraph(nodes, edges, viewport);
      return stringifyPersistedWorkflowGraph(ser);
    };

    const importGraphJson = (json: string) => {
      const g = parsePersistedWorkflowGraphJson(
        json.trim() ? json : EMPTY_WORKFLOW_GRAPH_JSON,
      );
      setNodes(toReactFlowNodes(g, catalog));
      setEdges(toReactFlowEdges(g));
      setViewport(persistedViewportToReactFlowViewport(g.viewport) ?? null);
    };

    useImperativeHandle(ref, () => ({ getGraphJson, importGraphJson }));

    const nodeTypesMap = useMemo(
      () => ({ workflowStep: WorkflowStepNode }),
      [],
    );

    return (
      <div
        data-slot="workflow-graph-layout"
        className={cn(
          "flex min-h-[320px] flex-col gap-3",
          className,
        )}
      >
        <div
          className={cn(
            "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40",
            readOnly && "workflow-graph-canvas-root--readonly",
            canvasAreaClassName,
          )}
        >
          <WorkflowGraphZoomContext.Provider value={{ zoomBy, zoomFit }}>
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
                <ReactFlowZoomBridge zoomApiRef={zoomApiRef} />
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
          </WorkflowGraphZoomContext.Provider>
        </div>
      </div>
    );
  });
