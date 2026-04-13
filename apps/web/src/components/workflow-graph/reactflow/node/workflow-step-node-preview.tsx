"use client";

import type { NodeParamModel } from "@/models/evaluation-metric/dto";
import { cn } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { WorkflowGraphContextProvider } from "../../workflow-graph-context";
import { WORKFLOW_GRAPH_RF_NODE_TYPES, WORKFLOW_GRAPH_RF_PRO_OPTIONS } from "../workflow-graph-reactflow-defaults";
import type { WorkflowNodeInputSpec, WorkflowSocketDefinition } from "../../types";
import { inputSpecToNodeParamModel, isWireInputSpec } from "../../workflow-node-input-spec";
import type { WorkflowStepNodeData } from "./nodes";

const PREVIEW_NODE_ID = "workflow-node-preview";

const fitViewOptions = { padding: 0.18, duration: 200 } as const;

function WorkflowStepNodePreviewFlow(props: WorkflowStepNodePreviewProps) {
  const {
    label,
    description,
    inputs,
    outputs,
    params = {},
    selected = true,
  } = props;

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

  useEffect(() => {
    setNodes([nextNode]);
  }, [nextNode, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={[]}
      nodeTypes={WORKFLOW_GRAPH_RF_NODE_TYPES}
      fitView
      fitViewOptions={fitViewOptions}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      panOnDrag={false}
      panOnScroll={false}
      preventScrolling
      proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
      className="h-full min-h-0 w-full !bg-transparent"
    >
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

export type WorkflowStepNodePreviewProps = {
  label: string;
  description?: string | null;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
  /** 与画布节点一致的参数字段 */
  params?: Record<string, unknown>;
  /** 与画布选中态一致的强调边框（传入 React Flow 节点的 selected） */
  selected?: boolean;
  className?: string;
};

/**
 * 在迷你画布中渲染与 {@link WorkflowStepNode} 相同的节点组件，保证与工作流编辑器中像素级一致。
 */
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
          <WorkflowStepNodePreviewFlow {...rest} />
        </WorkflowGraphContextProvider>
      </ReactFlowProvider>
    </div>
  );
}

function SocketListTable({
  title,
  rows,
}: {
  title: string;
  rows: WorkflowSocketDefinition[];
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">无</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">
        {rows.map((s) => (
          <li
            key={s.name}
            className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="font-medium text-foreground">
                {s.label?.trim() || s.name}
              </span>
              <code className="text-xs text-muted-foreground">{s.value_type}</code>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {s.required ? "必填" : "可选"} · {s.name}
            </div>
            {s.description?.trim() ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {s.description.trim()}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParamsListTable({ params }: { params: NodeParamModel[] }) {
  if (params.length === 0) {
    return (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          节点参数（声明）
        </h4>
        <p className="text-sm text-muted-foreground">无</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        节点参数（声明）
      </h4>
      <ul className="space-y-2 text-sm">
        {params.map((p) => (
          <li
            key={p.key}
            className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="font-medium text-foreground">
                {p.label?.trim() || p.key}
              </span>
              <code className="text-xs text-muted-foreground">{p.type}</code>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {p.key}
              {p.render_type ? ` · ${p.render_type}` : ""}
            </div>
            {p.description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkflowNodePreviewPanel(props: {
  label: string;
  description?: string | null;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
  /** 来自列表/详情的 ``workflow_parameters``，与 Python 侧 ``@workflow_node`` 声明一致 */
  declaredParams?: NodeParamModel[] | null;
  className?: string;
}) {
  const {
    label,
    description,
    inputs,
    outputs,
    declaredParams,
    className,
  } = props;

  const wireInputs = inputs.filter(isWireInputSpec);
  const inlineFromInputs = inputs
    .filter((s) => !isWireInputSpec(s))
    .map(inputSpecToNodeParamModel);

  const mergedParamModels: NodeParamModel[] = (() => {
    const byKey = new Map<string, NodeParamModel>();
    for (const p of declaredParams ?? []) {
      byKey.set(p.key, p);
    }
    for (const p of inlineFromInputs) {
      if (!byKey.has(p.key)) byKey.set(p.key, p);
    }
    return [...byKey.values()].sort((a, b) =>
      a.key.localeCompare(b.key, "zh-Hans-CN"),
    );
  })();

  return (
    <div className={cn("flex min-h-0 flex-col gap-6", className)}>
      <WorkflowStepNodePreview
        label={label}
        description={description}
        inputs={inputs}
        outputs={outputs}
        params={{}}
        selected
      />

      <div className="grid gap-6 min-[520px]:grid-cols-2">
        <SocketListTable title="输入接口" rows={wireInputs} />
        <SocketListTable title="输出接口" rows={outputs} />
      </div>

      <ParamsListTable params={mergedParamModels} />
    </div>
  );
}
