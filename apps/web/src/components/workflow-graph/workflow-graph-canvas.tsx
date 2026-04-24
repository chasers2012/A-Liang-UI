'use client';

import { AlertTriangle, Maximize2, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  addEdge,
  useReactFlow,
  useStore,
  type Connection,
  type IsValidConnection,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  WORKFLOW_GRAPH_RF_NODE_TYPES,
  WORKFLOW_GRAPH_RF_PRO_OPTIONS,
} from './reactflow/workflow-graph-reactflow-defaults';
import { resolveCollisions } from './reactflow/resolve-collisions';
import { WorkflowGraphContextProvider, useWorkflowGraphContext } from './workflow-graph-context';
import {
  toPersistedWorkflowGraph,
  toReactFlowEdges,
  toReactFlowNodes,
  WORKFLOW_INPUT_NODE_ID,
  WORKFLOW_OUTPUT_NODE_ID,
} from './reactflow/serialize';
import { normalizeAppendableHandle } from './reactflow/appendable-handle';

import type { WorkflowNodeInputSpec, WorkflowNodeTypeDefinition } from './types';
import { WorkflowGraphPersisted } from './reactflow/types';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';

/** 左侧「添加节点」拖到画布时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const WORKFLOW_GRAPH_NODE_DRAG_MIME = 'application/x-workflow-graph-node-type';

function isProtectedPreprocessingNode(node: Node): boolean {
  return node.id === WORKFLOW_INPUT_NODE_ID || node.id === WORKFLOW_OUTPUT_NODE_ID;
}

export function WorkflowGraphZoomToolbar(props: {
  readOnly?: boolean;
  onRefreshNodeDefinitions?: () => void;
  refreshingNodeDefinitions?: boolean;
}) {
  const { readOnly: readOnlyFromProps, onRefreshNodeDefinitions, refreshingNodeDefinitions = false } = props;
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, deleteElements } = useReactFlow();
  const { readOnly: readOnlyFromContext } = useWorkflowGraphContext();
  const readOnly = readOnlyFromProps ?? readOnlyFromContext;
  const hasDeletableSelection = useStore(
    useCallback(
      (s) =>
        s.getNodes().some((node) => node.selected && !isProtectedPreprocessingNode(node)) ||
        s.edges.some((e) => e.selected),
      [],
    ),
  );

  const onDeleteSelected = useCallback(() => {
    if (readOnly) return;
    const deletableNodes = getNodes().filter((node) => node.selected && !isProtectedPreprocessingNode(node));
    deleteElements({
      nodes: deletableNodes,
      edges: getEdges().filter((e) => e.selected),
    });
  }, [readOnly, deleteElements, getNodes, getEdges]);

  return (
    <Panel position="bottom-left" className="m-3!">
      <div
        data-slot="workflow-graph-zoom"
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md"
      >
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none border-b border-border text-destructive hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={!hasDeletableSelection}
            aria-label="删除选中的节点或连线"
            title="删除选中（Delete / Backspace）"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none border-b border-border"
            onClick={onRefreshNodeDefinitions}
            disabled={refreshingNodeDefinitions}
            aria-label="刷新当前工作流节点定义"
            title="刷新节点定义"
          >
            <RefreshCw className={cn('size-4', refreshingNodeDefinitions && 'animate-spin')} />
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
  addNode: (typeKey: string, opts?: { position?: { x: number; y: number } }) => void;
};

export type WorkflowGraphCanvasProps = {
  nodeTypes: WorkflowNodeTypeDefinition[];
  /** 初始图：工作流图对象（`{nodes,links}`）。 */
  initialGraph: WorkflowGraphPersisted;
  className?: string;
  readOnly?: boolean;
  onRefreshNodeDefinitions?: () => Promise<WorkflowNodeTypeDefinition[] | void> | WorkflowNodeTypeDefinition[] | void;
  onNodeSelect?: (node: { id: string; label?: string | null; outputs?: WorkflowNodeTypeDefinition['outputs'] }) => void;
};

function pickConnectionNodes(rf: ReactFlowInstance | null, sourceId: string, targetId: string) {
  if (!rf) return { sourceNode: undefined, targetNode: undefined };
  const allNodes = rf.getNodes();
  return {
    sourceNode: allNodes.find((n) => n.id === sourceId),
    targetNode: allNodes.find((n) => n.id === targetId),
  };
}

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">工作流渲染出错，请检查工作流文件</p>
          <p className="mt-1 text-xs break-all opacity-90">{error.message || ''}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-destructive/40 bg-background text-foreground hover:bg-muted"
          onClick={reset}
        >
          重试
        </Button>
      </div>
    </div>
  );
}
export const WorkflowGraphCanvas = forwardRef<WorkflowGraphCanvasHandle, WorkflowGraphCanvasProps>(
  function WorkflowGraphCanvas(
    { className, nodeTypes, initialGraph, readOnly = false, onRefreshNodeDefinitions, onNodeSelect },
    ref,
  ) {
    const catalog: Record<string, WorkflowNodeTypeDefinition> = useMemo(
      () => Object.fromEntries(nodeTypes.map((d) => [d.id, d])),
      [nodeTypes],
    );
    const reactFlowRef = useRef<ReactFlowInstance | null>(null);
    const initialNodes = useMemo(
      () => toReactFlowNodes(initialGraph, catalog, { readOnly }),
      [initialGraph, catalog, readOnly],
    );
    const initialEdges = useMemo(() => toReactFlowEdges(initialGraph), [initialGraph]);

    const fitViewOptions = useMemo(() => ({ padding: 0.18, duration: 200 }), []);
    const [refreshingNodeDefinitions, setRefreshingNodeDefinitions] = useState(false);

    const onInit = useCallback((inst: ReactFlowInstance) => {
      reactFlowRef.current = inst;
    }, []);

    useEffect(() => {
      const rf = reactFlowRef.current;
      if (!rf) return;
      rf.setNodes(initialNodes);
      rf.setEdges(initialEdges);
    }, [initialNodes, initialEdges]);

    const onNodeDragStop = useCallback(
      (_: unknown, node: Node) => {
        if (readOnly) return;
        const rf = reactFlowRef.current;
        if (!rf) return;
        rf.setNodes((nds) =>
          resolveCollisions(nds, {
            fixedNodeId: node.id,
            margin: 32,
            maxIterations: 80,
            overlapThreshold: 0.12,
          }),
        );
      },
      [readOnly],
    );

    const onConnect = useCallback(
      (c: Connection) => {
        if (readOnly) return;
        if (!c.target || !c.targetHandle) return;
        const rf = reactFlowRef.current;
        if (!rf) return;
        rf.setEdges((eds) => {
          const withoutSameInputHandle = eds.filter(
            (e) => !(e.target === c.target && e.targetHandle === c.targetHandle),
          );
          return addEdge(
            {
              ...c,
              id: crypto.randomUUID(),
              type: 'default',
            },
            withoutSameInputHandle,
          );
        });
      },
      [readOnly],
    );

    const onNodeClick = useCallback(
      (_: unknown, node: Node) => {
        const data = node.data as { label?: string; outputs?: WorkflowNodeTypeDefinition['outputs'] } | undefined;
        onNodeSelect?.({ id: node.id, label: data?.label ?? null, outputs: data?.outputs ?? [] });
      },
      [onNodeSelect],
    );

    const isValidConnection: IsValidConnection = useCallback((c) => {
      // 仅允许 “输出 -> 输入” 且两端 value_type 相同
      if (!c.source || !c.target) return false;
      if (!c.sourceHandle || !c.targetHandle) return false;

      const sourceHandle = normalizeAppendableHandle(c.sourceHandle);
      const targetHandle = normalizeAppendableHandle(c.targetHandle);

      const { sourceNode, targetNode } = pickConnectionNodes(reactFlowRef.current, c.source, c.target);
      const sourceOutputs = (sourceNode?.data as { outputs?: { name: string; value_type: string }[] } | undefined)
        ?.outputs;
      const targetInputs = (targetNode?.data as { inputs?: WorkflowNodeInputSpec[] } | undefined)?.inputs ?? [];

      const out = sourceOutputs?.find((s) => s.name === sourceHandle);
      const inp = targetInputs.find((s) => s.name === targetHandle);
      if (!out || !inp) return false;

      // 对于 param（内联字段）常见 value_type 为空；此时视为“任意类型可接入”，
      // 由后续将 param 提升为 socket 后再按节点真实输入类型约束。
      if (!inp.value_type || !out.value_type) return true;

      return out.value_type === inp.value_type;
    }, []);

    const addNode = useCallback(
      (typeKey: string, opts?: { position?: { x: number; y: number } }) => {
        if (readOnly) return;
        const def = catalog[typeKey];
        const rf = reactFlowRef.current;
        if (!rf) return;
        rf.setNodes((prev) => {
          const idx = prev.length;
          const fallbackPos = {
            x: 40 + (idx % 3) * 260,
            y: 40 + Math.floor(idx / 3) * 120,
          };
          const position = opts?.position ?? fallbackPos;
          const node = {
            id: crypto.randomUUID(),
            type: 'workflowStep',
            position,
            data: {
              backendType: typeKey,
              label: def?.label ?? typeKey,
              description: def?.description,
              inputs: def?.inputs ?? [],
              outputs: def?.outputs ?? [],
              params: {},
            },
          } satisfies Node;

          return resolveCollisions([...prev, node], {
            fixedNodeId: node.id,
            margin: 32,
            maxIterations: 80,
            overlapThreshold: 0.12,
          });
        });
      },
      [catalog, readOnly],
    );

    const applyNodeDefinitionsToCurrentGraph = useCallback((defs: WorkflowNodeTypeDefinition[]) => {
      const rf = reactFlowRef.current;
      if (!rf) return;
      const nextCatalog = Object.fromEntries(defs.map((d) => [d.id, d]));
      rf.setNodes((nodes) =>
        nodes.map((node) => {
          const data = (node.data ?? {}) as {
            backendType?: string;
            label?: string;
            description?: string;
            inputs?: WorkflowNodeTypeDefinition['inputs'];
            outputs?: WorkflowNodeTypeDefinition['outputs'];
          };
          const backendType = data.backendType;
          if (!backendType) return node;
          const def = nextCatalog[backendType];
          if (!def) return node;
          return {
            ...node,
            data: {
              ...data,
              label: def.label ?? backendType,
              description: def.description,
              inputs: def.inputs ?? [],
              outputs: def.outputs ?? [],
            },
          };
        }),
      );
    }, []);

    const onRefreshCurrentNodeDefinitions = useCallback(async () => {
      if (readOnly || refreshingNodeDefinitions) return;
      setRefreshingNodeDefinitions(true);
      try {
        const latestDefinitions = await onRefreshNodeDefinitions?.();
        applyNodeDefinitionsToCurrentGraph(latestDefinitions ?? nodeTypes);
      } finally {
        setRefreshingNodeDefinitions(false);
      }
    }, [applyNodeDefinitionsToCurrentGraph, nodeTypes, onRefreshNodeDefinitions, readOnly, refreshingNodeDefinitions]);

    const getGraph = useCallback(() => {
      const rf = reactFlowRef.current;
      if (!rf) {
        return toPersistedWorkflowGraph(initialNodes, initialEdges);
      }
      return toPersistedWorkflowGraph(rf.getNodes(), rf.getEdges());
    }, [initialEdges, initialNodes]);

    useImperativeHandle(ref, () => ({ getGraph, addNode }), [getGraph, addNode]);

    const onDragOver = useCallback(
      (e: React.DragEvent) => {
        if (readOnly) return;
        const has = e.dataTransfer.types.includes(WORKFLOW_GRAPH_NODE_DRAG_MIME);
        if (!has) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      },
      [readOnly],
    );

    const onDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
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
      },
      [addNode, readOnly],
    );

    return (
      <div data-slot="workflow-graph-layout" className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
        <div
          className={cn(
            'workflow-graph-canvas-root relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40',
            readOnly && 'workflow-graph-canvas-root--readonly',
          )}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <WorkflowGraphContextProvider readOnly={readOnly}>
            <ErrorBoundary errorComponent={Error}>
              <ReactFlow
                defaultNodes={initialNodes}
                defaultEdges={initialEdges}
                nodeTypes={WORKFLOW_GRAPH_RF_NODE_TYPES}
                onlyRenderVisibleElements
                onInit={onInit}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onConnect={readOnly ? undefined : onConnect}
                isValidConnection={readOnly ? undefined : isValidConnection}
                fitView
                fitViewOptions={fitViewOptions}
                deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable
                zoomOnScroll
                zoomOnPinch
                panOnScroll={false}
                proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
                className="h-full min-h-0 flex-1"
              >
                <Background
                  id="workflow-graph-bg"
                  gap={22}
                  size={1}
                  variant={BackgroundVariant.Dots}
                  className="opacity-60"
                />
                <WorkflowGraphZoomToolbar
                  readOnly={readOnly}
                  onRefreshNodeDefinitions={onRefreshCurrentNodeDefinitions}
                  refreshingNodeDefinitions={refreshingNodeDefinitions}
                />
              </ReactFlow>
            </ErrorBoundary>
          </WorkflowGraphContextProvider>
        </div>
      </div>
    );
  },
);
