"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  IoBlockHeader,
  SocketTypeBadge,
} from "./evaluation-workflow-canvas-io";
import {
  WorkflowNodeParamFieldRow,
  workflowNodeParamEffectiveValue,
} from "../../../../../components/workflow-graph/workflow-node-param-field-row";
import type { EvalWorkflowCanvasNode } from "./workflow-rf-utils";

export function EvaluationWorkflowNodeInspectorPanel(props: {
  readOnly: boolean;
  node: EvalWorkflowCanvasNode | null;
  onParamChange: (key: string, value: unknown) => void;
  onDeleteNode: () => void;
}) {
  const {
    readOnly,
    node,
    onParamChange,
    onDeleteNode,
  } = props;
  const workflowParamSpecs = Object.values(node?.data.params || {}) || [];

  if (!node) {
    return (
      <p className="leading-relaxed text-muted-foreground">
        {readOnly ? "点击节点查看类型" : "点击节点以编辑属性"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {node.data.category ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>{node.data.category}</span>
          </div>
        ) : null}
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {node.data.label}
        </div>
      </div>
      {node.data.inputs.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border/80">
          <IoBlockHeader kind="in" compact />
          <ul className="space-y-1 bg-muted/15 p-1.5">
            {node.data.inputs.map((inp) => (
              <li
                key={inp.name}
                className="rounded border border-border/40 bg-background/70 px-1.5 py-1 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_35%,transparent)]"
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="font-mono text-xs font-semibold leading-none text-foreground"
                    title={inp.name}
                  >
                    {inp.name}
                  </span>
                  {inp.required ? (
                    <span className="rounded bg-destructive/12 px-0.5 py-px text-[10px] font-semibold uppercase leading-none text-destructive">
                      必填
                    </span>
                  ) : null}
                </div>
                <SocketTypeBadge
                  valueType={inp.value_type}
                  className="mt-0.5"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {node.data.outputs.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border/80">
          <IoBlockHeader kind="out" compact />
          <ul className="space-y-1 bg-muted/15 p-1.5">
            {node.data.outputs.map((out) => (
              <li
                key={out.name}
                className="flex flex-col items-end rounded border border-border/40 bg-background/70 px-1.5 py-1 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_35%,transparent)]"
              >
                <span
                  className="max-w-full truncate font-mono text-xs font-semibold leading-none text-foreground"
                  title={out.name}
                >
                  {out.name}
                </span>
                <SocketTypeBadge
                  valueType={out.value_type}
                  alignEnd
                  className="mt-0.5"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {workflowParamSpecs.length > 0 ? (
        <div className="space-y-2 border-t border-border/80 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            节点参数
          </div>
          <div className="space-y-2">
            {workflowParamSpecs.map((spec) => (
              <WorkflowNodeParamFieldRow
                key={spec.key}
                spec={spec}
                readOnly={readOnly}
                value={workflowNodeParamEffectiveValue(
                  node.data.params,
                  spec,
                )}
                onChange={(v) => onParamChange(spec.key, v)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {readOnly ? (
        <p className="leading-relaxed text-muted-foreground">
          只读预览。修改工作流请使用「编辑」。
        </p>
      ) : null}
      {!readOnly ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-1 w-full gap-1"
          onClick={onDeleteNode}
        >
          <Trash2 className="size-3.5" />
          删除节点
        </Button>
      ) : null}
    </div>
  );
}
