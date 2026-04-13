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
  useNodesInitialized,
  useReactFlow,
  type FitViewOptions,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { MarkdownContent } from "@/components/markdown/markdown-content";
import { WorkflowGraphContextProvider } from "../../workflow-graph-context";
import { WORKFLOW_GRAPH_RF_NODE_TYPES, WORKFLOW_GRAPH_RF_PRO_OPTIONS } from "../workflow-graph-reactflow-defaults";
import type { WorkflowNodeInputSpec, WorkflowSocketDefinition } from "../../types";
import { inputSpecToNodeParamModel, isWireInputSpec } from "../../workflow-node-input-spec";
import type { WorkflowStepNodeData } from "./nodes";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";

/** 预览侧列表项：标题行拉满宽，类型徽标贴右，且允许多行标题（覆盖 ItemTitle 默认单行截断）。 */
const previewItemTitleClass =
  "!line-clamp-none w-full min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 font-normal";

const previewTypeBadgeClass =
  "shrink-0 rounded-md border border-border/60 bg-muted/45 px-1.5 py-0.5 font-mono text-[10px] font-normal leading-tight text-muted-foreground";

function PreviewTypeBadge({ children }: { children: string }) {
  const t = children.trim();
  if (!t) return null;
  return <code className={previewTypeBadgeClass}>{t}</code>;
}

function RequiredPill({ required }: { required: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        required
          ? "bg-primary/12 text-primary"
          : "bg-muted/80 text-muted-foreground",
      )}
    >
      {required ? "必填" : "可选"}
    </span>
  );
}

function PreviewMarkdownBlock({ content }: { content: string }) {
  return (
    <div className="mt-2.5 border-t border-border/40 pt-2.5">
      <MarkdownContent
        content={content}
        className="text-[11px] leading-relaxed text-muted-foreground"
      />
    </div>
  );
}

function previewSectionTitleClassName(extra?: string) {
  return cn(
    "mb-2.5 border-b border-border/45 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
    extra,
  );
}

const PREVIEW_NODE_ID = "workflow-node-preview";

const PREVIEW_FIT_VIEW: FitViewOptions = {
  padding: 0.32,
  duration: 220,
  maxZoom: 1.45,
  minZoom: 0.12,
  includeHiddenNodes: false,
  nodes: [{ id: PREVIEW_NODE_ID }],
};

function PreviewFitViewOnReady({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    if (!nodesInitialized) {
      return;
    }
    let cancelled = false;
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        if (!cancelled) {
          fitView(PREVIEW_FIT_VIEW);
        }
      });
      if (cancelled) {
        cancelAnimationFrame(id2);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
    };
  }, [fitView, fitKey, nodesInitialized]);

  return null;
}

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

  const fitKey = useMemo(
    () =>
      JSON.stringify({
        label,
        description,
        inputs,
        outputs,
        params,
        selected,
      }),
    [label, description, inputs, outputs, params, selected],
  );

  useEffect(() => {
    setNodes([nextNode]);
  }, [nextNode, setNodes]);

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
      preventScrolling
      proOptions={WORKFLOW_GRAPH_RF_PRO_OPTIONS}
      className="h-full min-h-0 w-full !bg-transparent"
    >
      <PreviewFitViewOnReady fitKey={fitKey} />
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

function SocketItem({ socket }: { socket: WorkflowSocketDefinition }) {
  return (
    <Item variant="outline" size="xs" className="bg-card/40 shadow-none">
      <ItemContent className="gap-1.5">
        <ItemTitle className={previewItemTitleClass}>
          <span className="min-w-0 break-words font-medium leading-snug text-foreground">
            {socket.label?.trim() || socket.name}
          </span>
          <PreviewTypeBadge>{socket.value_type}</PreviewTypeBadge>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground">
          <RequiredPill required={socket.required} />
          <span className="font-mono text-[10px] text-muted-foreground/90" title="字段名">
            {socket.name}
          </span>
        </div>
        {socket.description?.trim() ? (
          <PreviewMarkdownBlock content={socket.description.trim()} />
        ) : null}
      </ItemContent>
    </Item>
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
        <h4 className={previewSectionTitleClassName("mb-2")}>{title}</h4>
        <p className="text-xs text-muted-foreground">无</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className={previewSectionTitleClassName()}>{title}</h4>
      <ul className="flex list-none flex-col gap-2.5 p-0 text-sm">
        {rows.map((s) => (
          <SocketItem key={s.name} socket={s} />
        ))}
      </ul>
    </div>
  );
}

function ParamItem({ item }: { item: NodeParamModel }) {
  const renderType = item.render_type?.trim() ?? "";
  return (
    <Item variant="outline" size="xs" className="bg-card/40 shadow-none">
      <ItemContent className="gap-1.5">
        <ItemTitle className={previewItemTitleClass}>
          <span className="min-w-0 break-words font-medium leading-snug text-foreground">
            {item.label?.trim() || item.key}
          </span>
          {renderType ? <PreviewTypeBadge>{renderType}</PreviewTypeBadge> : null}
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground">
          <PreviewTypeBadge>{item.type}</PreviewTypeBadge>
          <span className="font-mono text-[10px] text-muted-foreground/90" title="参数键">
            {item.key}
          </span>
        </div>
        {item.description?.trim() ? (
          <PreviewMarkdownBlock content={item.description.trim()} />
        ) : null}
      </ItemContent>
    </Item>
  );
}

function ParamsListTable({ params }: { params: NodeParamModel[] }) {
  if (params.length === 0) {
    return (
      <div>
        <h4 className={previewSectionTitleClassName("mb-2")}>节点参数（声明）</h4>
        <p className="text-xs text-muted-foreground">无</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className={previewSectionTitleClassName()}>节点参数（声明）</h4>
      <ul className="flex list-none flex-col gap-2.5 p-0 text-sm">
        {params.map((p) => (
          <ParamItem key={p.key} item={p} />
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
    <div
      className={cn(
        "flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8",
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
        <SocketListTable title="输入接口" rows={wireInputs} />
        <SocketListTable title="输出接口" rows={outputs} />
        <ParamsListTable params={mergedParamModels} />
      </div>
      <div className="flex flex-col max-w-[500px] w-[500px]">
        <WorkflowStepNodePreview
          label={label}
          description={description}
          inputs={inputs}
          outputs={outputs}
          params={{}}
          selected
          className="h-full min-h-[280px] flex-1 max-lg:min-h-[min(400px,55vh)]"
        />
      </div>
    </div>
  );
}
