"use client";

import { Maximize2, Minus, Plus, Trash2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
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
  Panel,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  useStore,
  type Connection,
  type IsValidConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type ReactFlowInstance,
  type Viewport,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from "./reactflow/workflow-graph-reactflow-defaults";
import {
  WorkflowGraphContextProvider,
  useWorkflowGraphContext,
} from "./workflow-graph-context";
import {
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
} from "./reactflow/serialize";
import { normalizeAppendableHandle } from "./reactflow/appendable-handle";

import type { WorkflowNodeInputSpec, WorkflowNodeTypeDefinition } from "./types";
import { isWireInputSpec } from "./workflow-node-input-spec";
import { WorkflowGraphPersisted } from "./reactflow/types";


/** 左侧「添加节点」拖到画布时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const WORKFLOW_GRAPH_NODE_DRAG_MIME =
  "application/x-workflow-graph-node-type";


export function WorkflowGraphZoomToolbar() {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, deleteElements } =
    useReactFlow();
  const { readOnly } = useWorkflowGraphContext();
  const hasSelection = useStore(
    useCallback(
      (s) =>
        s.getNodes().some((n) => n.selected) ||
        s.edges.some((e) => e.selected),
      [],
    ),
  );

  const onDeleteSelected = useCallback(() => {
    if (readOnly) return;
    deleteElements({
      nodes: getNodes().filter((n) => n.selected),
      edges: getEdges().filter((e) => e.selected),
    });
  }, [readOnly, deleteElements, getNodes, getEdges]);

  return (
    <Panel position="bottom-left" className="m-3!">
      <div
        data-slot="workflow-graph-zoom"
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md backdrop-blur-md"
      >
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none border-b border-border text-destructive hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            aria-label="删除选中的节点或连线"
            title="删除选中（Delete / Backspace）"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none border-b border-border"
          onClick={() => zoomIn({ duration: 120 })}
          aria-label="放大"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none border-b border-border"
          onClick={() => zoomOut({ duration: 120 })}
          aria-label="缩小"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none"
          onClick={() => {
            fitView({ padding: 0.18, duration: 200 });
          }}
          aria-label="适应画布"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </Panel>
  );
}

export type WorkflowGraphCanvasHandle = {
  getGraph: () => WorkflowGraphPersisted;
  /** 在画布中添加一个节点（`typeKey` 为后端节点类型）。 */
  addNode: (
    typeKey: string,
    opts?: { position?: { x: number; y: number } },
  ) => void;
};

export type WorkflowGraphCanvasProps = {
  nodeTypes: WorkflowNodeTypeDefinition[];
  /** 初始图：工作流图对象（`{nodes,links,viewport}`）。 */
  initialGraph: WorkflowGraphPersisted;
  className?: string;
  readOnly?: boolean;
};


function useGraph(initialGraph: WorkflowGraphPersisted, catalog: Record<string, WorkflowNodeTypeDefinition>) {
  const initialNodes = useMemo(
    () => toReactFlowNodes(initialGraph, catalog),
    [initialGraph, catalog],
  );
  const initialEdges = useMemo(() => toReactFlowEdges(initialGraph), [initialGraph]);
  const initialViewport = useMemo(
    () => initialGraph.viewport,
    [initialGraph.viewport],
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [viewport, setViewport] = useState<Viewport | undefined>(
    initialViewport,
  );


  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges]);
  useEffect(() => {
    setViewport(initialViewport);
  }, [initialViewport]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect: OnConnect = useCallback((c: Connection) => {
    if (!c.target || !c.targetHandle) return;
    setEdges((eds) => {
      const withoutSameInputHandle = eds.filter(
        (e) =>
          !(e.target === c.target && e.targetHandle === c.targetHandle),
      );
      return addEdge(
        {
          ...c,
          id: crypto.randomUUID(),
          type: "default",
        },
        withoutSameInputHandle,
      );
    });
  }, []);

  return useMemo(() => ({
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setViewport,
    setNodes,
    initialViewport
  }), [nodes, edges, viewport, onNodesChange, onEdgesChange, onConnect, setViewport, setNodes, initialViewport]);
}



export const WorkflowGraphCanvas = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(
  function WorkflowGraphCanvas(
    { className, nodeTypes, initialGraph, readOnly = false },
    ref,
  ) {
    const catalog: Record<string, WorkflowNodeTypeDefinition> = useMemo(() => Object.fromEntries(nodeTypes.map((d) => [d.type, d])), [nodeTypes]);
    const reactFlowRef = useRef<ReactFlowInstance | null>(null);

    const { nodes, edges, viewport, onNodesChange, onEdgesChange, onConnect, setViewport, setNodes, initialViewport } = useGraph(initialGraph, catalog);



    const isValidConnection: IsValidConnection = useCallback(
      (c) => {
        // 仅允许 “输出 -> 输入” 且两端 value_type 相同
        if (!c.source || !c.target) return false;
        if (!c.sourceHandle || !c.targetHandle) return false;

        const sourceHandle = normalizeAppendableHandle(c.sourceHandle);
        const targetHandle = normalizeAppendableHandle(c.targetHandle);

        const sourceNode = nodes.find((n) => n.id === c.source);
        const targetNode = nodes.find((n) => n.id === c.target);
        const sourceOutputs = (sourceNode?.data as { outputs?: { name: string; value_type: string }[] } | undefined)
          ?.outputs;
        const targetInputsRaw = (targetNode?.data as { inputs?: WorkflowNodeInputSpec[] } | undefined)
          ?.inputs;
        const targetInputs = (targetInputsRaw ?? []).filter(isWireInputSpec);

        const out = sourceOutputs?.find((s) => s.name === sourceHandle);
        const inp = targetInputs.find((s) => s.name === targetHandle);
        if (!out || !inp) return false;

        return out.value_type === inp.value_type;
      },
      [nodes],
    );

    const onMoveEnd = (_: unknown, vp: Viewport) => {
      setViewport(vp);
    };

    const addNode = useCallback(
      (typeKey: string, opts?: { position?: { x: number; y: number } }) => {
        if (readOnly) return;
        const def = catalog[typeKey];
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
      [catalog, readOnly, setNodes],
    );

    const getGraph = useCallback(() => {
      return toPersistedWorkflowGraph(nodes, edges, viewport);
    }, [nodes, edges, viewport]);



    useImperativeHandle(ref, () => ({ getGraph, addNode }), [
      getGraph,
      addNode,
    ]);

    const onDragOver = (e: React.DragEvent) => {
      if (readOnly) return;
      const has = e.dataTransfer.types.includes(WORKFLOW_GRAPH_NODE_DRAG_MIME);
      if (!has) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
      if (readOnly) return;
      const typeKey = e.dataTransfer.getData(WORKFLOW_GRAPH_NODE_DRAG_MIME);
      if (!typeKey) return;
      e.preventDefault();

      const rf = reactFlowRef.current;
      const el = e.currentTarget;
      if (!rf) {
        addNode(typeKey);
        return;
      }
      const rect = el.getBoundingClientRect();
      const clientPoint = { x: e.clientX, y: e.clientY };
      const flowPos = rf.screenToFlowPosition(clientPoint);
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
          "flex min-h-[320px] flex-col gap-3", className
        )}
      >
        <div
          className={cn(
            "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40",
            readOnly && "workflow-graph-canvas-root--readonly",
          )}
        >
          <WorkflowGraphContextProvider readOnly={readOnly}>
            <div
              className="relative min-h-[280px] flex-1"
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={WORKFLOW_GRAPH_RF_NODE_TYPES}
                onInit={(inst) => {
                  reactFlowRef.current = inst;
                }}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={readOnly ? undefined : onConnect}
                isValidConnection={readOnly ? undefined : isValidConnection}
                onMoveEnd={onMoveEnd}
                defaultViewport={initialViewport}
                fitView={!initialViewport}
                deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable={!readOnly}
                zoomOnScroll
                zoomOnPinch
                panOnScroll={false}
                proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
                className="min-h-[280px] flex-1"
              >
                <Background
                  id="workflow-graph-bg"
                  gap={22}
                  size={1}
                  variant={BackgroundVariant.Dots}
                  className="opacity-60"
                />
                <Controls showInteractive={false} />
                <WorkflowGraphZoomToolbar />
              </ReactFlow>

            </div>
          </WorkflowGraphContextProvider>
        </div>
      </div>
    );
  });
