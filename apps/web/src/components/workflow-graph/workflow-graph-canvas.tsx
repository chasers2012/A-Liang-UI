"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import {
  ReactNode,
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
import { catalogToMap } from "./graph-model";

import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from "./reactflow/workflow-graph-reactflow-defaults";
import { WorkflowGraphContextProvider } from "./workflow-graph-context";
import {
  parsePersistedWorkflowGraphJson,
  persistedViewportToReactFlowViewport,
  stringifyPersistedWorkflowGraph,
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
} from "./reactflow/serialize";
import { normalizeAppendableHandle } from "./reactflow/appendable-handle";

import type { WorkflowNodeInputSpec, WorkflowNodeTypeDefinition } from "./types";
import { isWireInputSpec } from "./workflow-node-input-spec";


/** 左侧「添加节点」拖到画布时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const WORKFLOW_GRAPH_NODE_DRAG_MIME =
  "application/x-workflow-graph-node-type";


/** 须作为 `WorkflowGraphCanvas` 的 children 渲染（位于 React Flow 树内），以便使用 `useReactFlow`。 */
export function WorkflowGraphZoomToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="m-3!">
      <div
        data-slot="workflow-graph-zoom"
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md backdrop-blur-md"
      >
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
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  getGraphJson: () => string;
  /** 在画布中添加一个节点（`typeKey` 为后端节点类型）。 */
  addNode: (
    typeKey: string,
    opts?: { position?: { x: number; y: number } },
  ) => void;
};

export type WorkflowGraphCanvasProps = {
  nodeTypes: WorkflowNodeTypeDefinition[];
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  initialGraphJson: string;
  className?: string;
  readOnly?: boolean;

  children?: ReactNode;
};



export const WorkflowGraphCanvas = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(
  function WorkflowGraphCanvas(
    { className, nodeTypes, initialGraphJson, readOnly = false, children },
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

    const reactFlowRef = useRef<ReactFlowInstance | null>(null);

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



    useImperativeHandle(ref, () => ({ getGraphJson, addNode }), [
      getGraphJson,
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
                {children}
              </ReactFlow>
            </div>
          </WorkflowGraphContextProvider>
        </div>
      </div>
    );
  });
