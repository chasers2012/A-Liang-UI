"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MetricWorkflowParamSpec } from "@/models/evaluation-metric/dto";

import {
  IoBlockHeader,
  SocketTypeBadge,
} from "./evaluation-workflow-canvas-io";
import {
  MetricWorkflowParamFieldRow,
  metricWorkflowParamEffectiveValue,
} from "./metric-workflow-param-field-row";
import type { EvalWorkflowCanvasNode } from "./workflow-rf-utils";

export function EvaluationWorkflowNodeInspectorPanel(props: {
  readOnly: boolean;
  node: EvalWorkflowCanvasNode | null;
  workflowParamSpecs: MetricWorkflowParamSpec[];
  onParamChange: (key: string, value: unknown) => void;
  onDeleteNode: () => void;
}) {
  const {
    readOnly,
    node,
    workflowParamSpecs,
    onParamChange,
    onDeleteNode,
  } = props;

  if (!node) {
    return (
      <p className="leading-relaxed text-muted-foreground">
        {readOnly ? "点击节点查看类型" : "点击节点以编辑属性"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {readOnly ? "节点" : "节点属性"}
      </div>
      <div
        className="break-all font-mono text-xs leading-snug text-muted-foreground"
        title={node.data.backendType}
      >
        {node.data.backendType}
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
            指标参数
          </div>
          <div className="space-y-2">
            {workflowParamSpecs.map((spec) => (
              <MetricWorkflowParamFieldRow
                key={spec.key}
                spec={spec}
                readOnly={readOnly}
                value={metricWorkflowParamEffectiveValue(
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
      ) : node.data.backendType.startsWith("metric:") ? (
        <p className="leading-relaxed text-muted-foreground">
          {workflowParamSpecs.length > 0
            ? "其余 params 请在「JSON」模式中编辑。"
            : "指标已绑定到该节点类型。可在指标编辑中配置工作流参数，或使用「JSON」模式编辑 params。"}
        </p>
      ) : (
        <p className="leading-relaxed text-muted-foreground">
          params 请在「JSON」模式中编辑。
        </p>
      )}
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
