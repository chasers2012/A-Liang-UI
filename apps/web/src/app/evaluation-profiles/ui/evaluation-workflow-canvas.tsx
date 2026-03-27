"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ConnectionLineType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import type {
  EvaluationWorkflowDto,
  NodeTypeDefinitionPublic,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import {
  EVAL_WORKFLOW_NODE_TYPE,
  type EvalWorkflowNodeData,
  catalogToMap,
  enrichNodeData,
  nodesEdgesToWorkflow,
  workflowToNodesEdges,
} from "./workflow-rf-utils";
import {
  IoBlockHeader,
  SocketTypeBadge,
} from "./evaluation-workflow-canvas-io";
import { EvaluationWorkflowNodeInspectorPanel } from "./evaluation-workflow-node-inspector-panel";

import "./evaluation-workflow-canvas.css";

type EvalRFNode = Node<EvalWorkflowNodeData, typeof EVAL_WORKFLOW_NODE_TYPE>;

const DEFAULT_EDGE_OPTIONS = {
  type: "smoothstep" as const,
  style: {
    stroke: "color-mix(in oklch, var(--muted-foreground) 42%, var(--border))",
    strokeWidth: 2,
  },
};

const FIT_VIEW_OPTIONS = { padding: 0.14, maxZoom: 1.15, minZoom: 0.08 };

function workflowNodeAccentClass(backendType: string): string {
  if (backendType === "prepare_alphalens") {
    return "bg-emerald-600 dark:bg-emerald-500";
  }
  if (backendType.startsWith("metric:")) {
    return "bg-sky-600 dark:bg-sky-500";
  }
  if (backendType === "user_metric") {
    return "bg-violet-600 dark:bg-violet-500";
  }
  return "bg-muted-foreground/55";
}

const HANDLE_CN =
  "!z-[2] !h-2.5 !w-2.5 !border-2 !border-background !transition-transform duration-150 group-hover:scale-110";

function EvalWorkflowNode({ data, selected }: NodeProps<EvalRFNode>) {
  const { label, inputs, outputs, backendType } = data;
  const accent = workflowNodeAccentClass(backendType);
  return (
    <div
      className={cn(
        "group relative min-w-[160px] max-w-[248px] overflow-visible rounded-lg border border-border/90 bg-card text-[0.7rem] shadow-sm transition-shadow duration-200",
        selected
          ? "border-primary/35 shadow-md ring-2 ring-primary/20 ring-offset-1 ring-offset-background"
          : "hover:border-border hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-0 w-[3px] rounded-l-[inherit]",
          accent,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-[1] overflow-hidden rounded-t-lg px-2.5 py-1.5 pl-[11px]",
          inputs.length === 0 && outputs.length === 0 && "rounded-b-lg",
        )}
      >
        <div className="truncate text-[0.75rem] font-semibold leading-tight tracking-tight">
          {label}
        </div>
        <div
          className="mt-px truncate font-mono text-[0.58rem] leading-tight text-muted-foreground"
          title={backendType}
        >
          {backendType}
        </div>
      </div>

      {inputs.length > 0 ? (
        <div
          className={cn(
            "relative z-[1] border-t border-border/50",
            outputs.length === 0 && "overflow-hidden rounded-b-lg",
          )}
        >
          <IoBlockHeader kind="in" compact />
          <div className="space-y-0 bg-muted/[0.12] px-1 py-0.5">
            {inputs.map((inp, idx) => (
              <div
                key={`in-${inp.name}`}
                className={cn(
                  "relative px-0.5 py-px",
                  idx > 0 && "mt-px border-t border-border/20 pt-0.5",
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center rounded bg-background/55 py-1 pl-3 pr-1.5 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_60%,transparent)]",
                    "dark:bg-background/25",
                  )}
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={inp.name}
                    className={cn(
                      HANDLE_CN,
                      "!absolute !left-0 !top-1/2 !-translate-x-1/2 !translate-y-1/2 !bg-sky-600 dark:!bg-sky-500",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <div className="flex min-w-0 items-center gap-1">
                      <span
                        className="truncate font-mono text-[0.62rem] font-semibold leading-none text-foreground"
                        title={inp.name}
                      >
                        {inp.name}
                      </span>
                      {inp.required ? (
                        <span
                          className="shrink-0 rounded bg-destructive/12 px-0.5 py-px text-[0.45rem] font-semibold uppercase leading-none text-destructive"
                          title="必填"
                        >
                          必填
                        </span>
                      ) : null}
                    </div>
                    <SocketTypeBadge valueType={inp.value_type} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {outputs.length > 0 ? (
        <div className="relative z-[1] overflow-hidden rounded-b-lg border-t border-border/50">
          <IoBlockHeader kind="out" compact />
          <div className="space-y-0 bg-muted/[0.12] px-1 py-0.5">
            {outputs.map((out, idx) => (
              <div
                key={`out-${out.name}`}
                className={cn(
                  "relative px-0.5 py-px",
                  idx > 0 && "mt-px border-t border-border/20 pt-0.5",
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center rounded bg-background/55 py-1 pl-1.5 pr-3 text-right shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_60%,transparent)]",
                    "dark:bg-background/25",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col items-end gap-px text-right">
                    <span
                      className="max-w-full truncate font-mono text-[0.62rem] font-semibold leading-none text-foreground"
                      title={out.name}
                    >
                      {out.name}
                    </span>
                    <SocketTypeBadge
                      valueType={out.value_type}
                      alignEnd
                    />
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={out.name}
                    className={cn(
                      HANDLE_CN,
                      "!absolute !right-0 !top-1/2 !translate-x-1/2 !-translate-y-1/2 !bg-emerald-600 shadow-sm dark:!bg-emerald-500",
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes = { [EVAL_WORKFLOW_NODE_TYPE]: EvalWorkflowNode };

export type EvaluationWorkflowCanvasHandle = {
  getWorkflow: () => EvaluationWorkflowDto;
  importWorkflow: (w: EvaluationWorkflowDto) => void;
};

type InnerProps = {
  catalog: NodeTypeDefinitionPublic[];
  initialWorkflow: EvaluationWorkflowDto;
  /** 仅浏览：不可增删改连线与拖拽节点（仍平移/缩放）。 */
  readOnly?: boolean;
};

const WorkflowCanvasInner = forwardRef<
  EvaluationWorkflowCanvasHandle,
  InnerProps
>(function WorkflowCanvasInner(
  { catalog, initialWorkflow, readOnly = false },
  ref,
) {
  const catMap = useMemo(() => catalogToMap(catalog), [catalog]);
  const initial = useMemo(
    () => workflowToNodesEdges(initialWorkflow, catMap),
    [initialWorkflow, catMap],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<EvalRFNode>(
    initial.nodes as EvalRFNode[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { getViewport, setViewport, fitView } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getWorkflow = useCallback((): EvaluationWorkflowDto => {
    const vp = getViewport();
    return nodesEdgesToWorkflow(nodes, edges, {
      x: vp.x,
      y: vp.y,
      zoom: vp.zoom,
    });
  }, [nodes, edges, getViewport]);

  const importWorkflow = useCallback(
    (w: EvaluationWorkflowDto) => {
      const { nodes: n, edges: e } = workflowToNodesEdges(w, catMap);
      setNodes(n as EvalRFNode[]);
      setEdges(e);
      setSelectedId(null);
      requestAnimationFrame(() => {
        if (w.viewport) {
          void setViewport({
            x: w.viewport.x,
            y: w.viewport.y,
            zoom: w.viewport.zoom,
          });
        } else {
          fitView(FIT_VIEW_OPTIONS);
        }
      });
    },
    [catMap, fitView, setEdges, setNodes, setViewport],
  );

  useImperativeHandle(ref, () => ({ getWorkflow, importWorkflow }), [
    getWorkflow,
    importWorkflow,
  ]);

  const onConnect = useCallback(
    (p: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...p,
            ...DEFAULT_EDGE_OPTIONS,
            id: `e-${p.source}-${p.sourceHandle ?? ""}-${p.target}-${p.targetHandle ?? ""}-${eds.length}`,
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId);

  const selectedTypeDef = useMemo(
    () =>
      selectedNode
        ? catalog.find((c) => c.type === selectedNode.data.backendType)
        : undefined,
    [catalog, selectedNode],
  );
  const workflowParamSpecs = selectedTypeDef?.workflow_parameters ?? [];

  const patchSelectedParams = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedId) return n;
          const d = n.data;
          const next = { ...d.params };
          if (value === "" || value === undefined) {
            delete next[key];
          } else {
            next[key] = value;
          }
          return { ...n, data: { ...d, params: next } };
        }),
      );
    },
    [selectedId, setNodes],
  );

  const addNode = useCallback(
    (backendType: string) => {
      const id = crypto.randomUUID();
      const wfNode: WorkflowNodeDto = {
        id,
        type: backendType,
        pos: [120 + Math.random() * 80, 80 + Math.random() * 80],
        params: {},
      };
      const data = enrichNodeData(wfNode, catMap);
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: EVAL_WORKFLOW_NODE_TYPE,
          position: { x: wfNode.pos[0], y: wfNode.pos[1] },
          data,
        },
      ]);
    },
    [catMap, setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) =>
      es.filter((e) => e.source !== selectedId && e.target !== selectedId),
    );
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  return (
    <div
      className={cn(
        "flex h-[min(560px,72vh)] min-h-[320px] flex-col gap-3",
        !readOnly && "sm:flex-row",
      )}
    >
      {!readOnly ? (
        <aside className="flex w-full shrink-0 flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 shadow-sm sm:w-[11.5rem]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            添加节点
          </p>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-0.5 sm:max-h-none sm:flex-col sm:gap-1">
            {catalog.map((t) => (
              <Button
                key={t.type}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 justify-start border-border/80 bg-background/80 text-xs font-medium shadow-none hover:bg-accent/60"
                onClick={() => addNode(t.type)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </aside>
      ) : null}
      <div
        className={cn(
          "evaluation-wf-canvas relative min-h-[300px] flex-1 overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-muted/25 via-background to-muted/20 shadow-inner ring-1 ring-black/[0.04] dark:from-muted/15 dark:via-background dark:to-muted/10 dark:ring-white/[0.06]",
          readOnly && "evaluation-wf-canvas--readonly",
        )}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          proOptions={{ hideAttribution: true }}
          snapToGrid={!readOnly}
          snapGrid={[12, 12]}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          edgesReconnectable={!readOnly}
          deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
          className="bg-transparent"
        >
          <Background
            id="eval-wf-dots"
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.1}
            color="var(--border)"
            className="opacity-[0.65] dark:opacity-90"
          />
          <Controls
            showInteractive={false}
            className="!m-3 !shadow-none"
          />
          <MiniMap
            zoomable
            pannable
            className="!mb-3 !ml-3 !rounded-xl !border-0 !shadow-none"
            maskColor="color-mix(in oklch, var(--background) 72%, transparent)"
            nodeColor="color-mix(in oklch, var(--muted) 88%, var(--foreground))"
            nodeStrokeColor="var(--border)"
            nodeStrokeWidth={2}
            nodeBorderRadius={6}
          />
          <Panel
            position="top-right"
            className="m-3 max-w-[min(260px,calc(100%-1.5rem))] rounded-lg border border-border/70 bg-card/92 p-2.5 text-[0.7rem] shadow-lg backdrop-blur-md"
          >
            <EvaluationWorkflowNodeInspectorPanel
              readOnly={readOnly}
              node={selectedNode ?? null}
              workflowParamSpecs={workflowParamSpecs}
              onParamChange={patchSelectedParams}
              onDeleteNode={deleteSelected}
            />
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
});

export type EvaluationWorkflowCanvasProps = InnerProps;

export const EvaluationWorkflowCanvas = forwardRef<
  EvaluationWorkflowCanvasHandle,
  InnerProps
>(function EvaluationWorkflowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
