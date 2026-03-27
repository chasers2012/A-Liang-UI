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
  Controls,
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
import { Trash2 } from "lucide-react";

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

type EvalRFNode = Node<EvalWorkflowNodeData, typeof EVAL_WORKFLOW_NODE_TYPE>;

function EvalWorkflowNode({ data, selected }: NodeProps<EvalRFNode>) {
  const { label, inputs, outputs, backendType } = data;
  return (
    <div
      className={cn(
        "relative min-w-[150px] rounded-md border border-border bg-card px-2 py-2 text-xs shadow-sm",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <div className="truncate font-medium">{label}</div>
      <div className="truncate font-mono text-[0.65rem] text-muted-foreground">
        {backendType}
      </div>
      {inputs.map((inp, i) => (
        <Handle
          key={`in-${inp.name}`}
          type="target"
          position={Position.Left}
          id={inp.name}
          className="h-2.5! w-2.5! border-2! border-border! bg-background!"
          style={{
            top:
              inputs.length === 1
                ? "50%"
                : `${((i + 1) / (inputs.length + 1)) * 100}%`,
          }}
        />
      ))}
      {outputs.map((out, i) => (
        <Handle
          key={`out-${out.name}`}
          type="source"
          position={Position.Right}
          id={out.name}
          className="h-2.5! w-2.5! border-2! border-border! bg-primary!"
          style={{
            top:
              outputs.length === 1
                ? "50%"
                : `${((i + 1) / (outputs.length + 1)) * 100}%`,
          }}
        />
      ))}
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
};

const WorkflowCanvasInner = forwardRef<
  EvaluationWorkflowCanvasHandle,
  InnerProps
>(function WorkflowCanvasInner(
  { catalog, initialWorkflow },
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
          fitView({ padding: 0.2 });
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
            id: `e-${p.source}-${p.sourceHandle ?? ""}-${p.target}-${p.targetHandle ?? ""}-${eds.length}`,
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId);

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
    <div className="flex h-[min(520px,70vh)] min-h-[320px] flex-col gap-2 sm:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
        <p className="text-xs font-medium text-muted-foreground">添加节点</p>
        <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto sm:max-h-none sm:flex-col">
          {catalog.map((t) => (
            <Button
              key={t.type}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 justify-start text-xs"
              onClick={() => addNode(t.type)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative min-h-[280px] flex-1 rounded-md border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[12, 12]}
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-muted/20"
        >
          <Background />
          <Controls />
          <MiniMap zoomable pannable className="bg-card!" />
          <Panel
            position="top-right"
            className="m-2 max-w-[240px] rounded-md border border-border bg-card p-2 text-xs shadow-md"
          >
            {selectedNode ? (
              <div className="space-y-2">
                <div className="font-medium">节点属性</div>
                <div className="font-mono text-[0.65rem] text-muted-foreground">
                  {selectedNode.data.backendType}
                </div>
                {selectedNode.data.backendType.startsWith("metric:") ? (
                  <p className="text-muted-foreground text-[0.7rem] leading-relaxed">
                    指标已绑定到该节点类型。可选参数请在「JSON」模式中编辑。
                  </p>
                ) : (
                  <p className="text-muted-foreground text-[0.65rem]">
                    params 请在「JSON」模式中编辑。
                  </p>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1"
                  onClick={deleteSelected}
                >
                  <Trash2 className="size-3.5" />
                  删除节点
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">点击节点以编辑属性</p>
            )}
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
