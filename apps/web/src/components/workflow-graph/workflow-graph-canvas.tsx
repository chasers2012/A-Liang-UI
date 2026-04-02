"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import {
  createContext,
  forwardRef,
  useCallback,
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
  type IsValidConnection,
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
import { WORKFLOW_GRAPH_NODE_DRAG_MIME } from "./workflow-graph-canvas-constants";
import type {
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "./workflow-graph-canvas-types";
import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from "./reactflow/workflow-graph-reactflow-defaults";
import { WorkflowGraphReadOnlyProvider } from "./workflow-graph-readonly-context";
import {
  EMPTY_WORKFLOW_GRAPH_JSON,
  parsePersistedWorkflowGraphJson,
  persistedViewportToReactFlowViewport,
  stringifyPersistedWorkflowGraph,
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
} from "./reactflow/serialize";

import type { WorkflowNodeInputSpec } from "./types";
import { isWireInputSpec } from "./workflow-node-input-spec";


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

type ReactFlowApi = {
  screenToFlowPosition: (pt: { x: number; y: number }) => { x: number; y: number };
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
    const rfApiRef = useRef<ReactFlowApi | null>(null);
    const dropAreaRef = useRef<HTMLDivElement | null>(null);

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

    const isValidConnection: IsValidConnection = useCallback(
      (c) => {
        // 仅允许 “输出 -> 输入” 且两端 value_type 相同
        if (!c.source || !c.target) return false;
        if (!c.sourceHandle || !c.targetHandle) return false;

        const sourceNode = nodes.find((n) => n.id === c.source);
        const targetNode = nodes.find((n) => n.id === c.target);
        const sourceOutputs = (sourceNode?.data as { outputs?: { name: string; value_type: string }[] } | undefined)
          ?.outputs;
        const targetInputsRaw = (targetNode?.data as { inputs?: WorkflowNodeInputSpec[] } | undefined)
          ?.inputs;
        const targetInputs = (targetInputsRaw ?? []).filter(isWireInputSpec);

        const out = sourceOutputs?.find((s) => s.name === c.sourceHandle);
        const inp = targetInputs.find((s) => s.name === c.targetHandle);
        if (!out || !inp) return false;

        return out.value_type === inp.value_type;
      },
      [nodes],
    );

    const onMoveEnd = (_: unknown, vp: Viewport) => {
      setViewport(vp);
    };

    const zoomBy = (factor: number) => zoomApiRef.current?.zoomBy(factor);
    const zoomFit = () => zoomApiRef.current?.fitView();

    const addNode = useCallback(
      (typeKey: string, opts?: { position?: { x: number; y: number } }) => {
        if (readOnly) return;
        const def = catalog.get(typeKey);
        setNodes((prev) => {
          const idx = prev.length;
          const fallbackPos = {
            x: 40 + (idx % 3) * 260,
            y: 40 + Math.floor(idx / 3) * 120,
          };
          const position = opts?.position ?? fallbackPos;
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "workflowStep",
              position,
              data: {
                backendType: typeKey,
                label: def?.label ?? typeKey,
                inputs: def?.inputs ?? [],
                outputs: def?.outputs ?? [],
                params: {},
              },
            } satisfies Node,
          ];
        });
      },
      [catalog, readOnly],
    );

    const getGraphJson = useCallback(() => {
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
        setViewport(persistedViewportToReactFlowViewport(g.viewport) ?? null);
      },
      [catalog],
    );

    useImperativeHandle(ref, () => ({ getGraphJson, importGraphJson, addNode }), [
      getGraphJson,
      importGraphJson,
      addNode,
    ]);

    const onDragOver = (e: React.DragEvent) => {
      if (readOnly) return;
      const has = e.dataTransfer.types.includes(WORKFLOW_GRAPH_NODE_DRAG_MIME);
      if (!has) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = (e: React.DragEvent) => {
      if (readOnly) return;
      const typeKey = e.dataTransfer.getData(WORKFLOW_GRAPH_NODE_DRAG_MIME);
      if (!typeKey) return;
      e.preventDefault();

      const el = dropAreaRef.current;
      const rfApi = rfApiRef.current;
      if (!el || !rfApi) {
        addNode(typeKey);
        return;
      }
      const rect = el.getBoundingClientRect();
      const clientPoint = { x: e.clientX, y: e.clientY };
      const flowPos = rfApi.screenToFlowPosition(clientPoint);
      if (
        clientPoint.x < rect.left ||
        clientPoint.x > rect.right ||
        clientPoint.y < rect.top ||
        clientPoint.y > rect.bottom
      ) {
        addNode(typeKey);
        return;
      }
      addNode(typeKey, { position: flowPos });
    };

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
            <WorkflowGraphReadOnlyProvider readOnly={readOnly}>
              <div
                ref={dropAreaRef}
                className="relative min-h-[280px] flex-1"
                onDragOver={onDragOver}
                onDrop={onDrop}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={WORKFLOW_GRAPH_RF_NODE_TYPES}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={readOnly ? undefined : onConnect}
                  isValidConnection={readOnly ? undefined : isValidConnection}
                  onMoveEnd={onMoveEnd}
                  defaultViewport={initialViewport}
                  fitView={!initialViewport}
                  nodesDraggable={!readOnly}
                  nodesConnectable={!readOnly}
                  elementsSelectable={!readOnly}
                  zoomOnScroll
                  zoomOnPinch
                  panOnScroll={false}
                  proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
                >
                  <ReactFlowZoomBridge zoomApiRef={zoomApiRef} />
                  <ReactFlowApiBridge rfApiRef={rfApiRef} />
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
            </WorkflowGraphReadOnlyProvider>
          </WorkflowGraphZoomContext.Provider>
        </div>
      </div>
    );
  });

function ReactFlowApiBridge({
  rfApiRef,
}: {
  rfApiRef: React.MutableRefObject<ReactFlowApi | null>;
}) {
  const rf = useReactFlow();

  useEffect(() => {
    rfApiRef.current = {
      screenToFlowPosition: (pt: { x: number; y: number }) => {
        const anyRf = rf as unknown as {
          screenToFlowPosition?: (p: { x: number; y: number }) => { x: number; y: number };
          project?: (p: { x: number; y: number }) => { x: number; y: number };
        };
        if (typeof anyRf.screenToFlowPosition === "function") return anyRf.screenToFlowPosition(pt);
        if (typeof anyRf.project === "function") return anyRf.project(pt);
        return pt;
      },
    };
    return () => {
      rfApiRef.current = null;
    };
  }, [rf, rfApiRef]);

  return null;
}
