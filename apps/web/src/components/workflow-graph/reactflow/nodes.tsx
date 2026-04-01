"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { cn } from "@/lib/utils";
import type { WorkflowSocketDefinition } from "../types";

export type WorkflowStepNodeData = {
  backendType: string;
  label: string;
  inputs: WorkflowSocketDefinition[];
  outputs: WorkflowSocketDefinition[];
  params: Record<string, unknown>;
};

function SocketRow({
  side,
  s,
}: {
  side: "input" | "output";
  s: WorkflowSocketDefinition;
}) {
  const isInput = side === "input";
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 py-1 text-xs text-muted-foreground",
        isInput ? "justify-start pr-2 pl-3" : "justify-end pr-3 pl-2",
      )}
    >
      <Handle
        type={isInput ? "target" : "source"}
        position={isInput ? Position.Left : Position.Right}
        id={s.name}
        className={cn(
          "h-2.5! w-2.5! rounded-sm! border! border-border! bg-background!",
          isInput ? "left-0!" : "right-0!",
        )}
      />
      <span className={cn("truncate", isInput ? "" : "text-right")}>
        {s.name}
      </span>
    </div>
  );
}

export const WorkflowStepNode = memo(function WorkflowStepNode(
  props: NodeProps<WorkflowStepNodeData>,
) {
  const { data, selected } = props;
  const inputs = data.inputs ?? [];
  const outputs = data.outputs ?? [];

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-lg border bg-popover/95 text-popover-foreground shadow-sm backdrop-blur",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-5">
            {data.label}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {data.backendType}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0">
        <div className="border-r border-border/60 py-1">
          {inputs.length > 0 ? (
            inputs.map((s) => <SocketRow key={s.name} side="input" s={s} />)
          ) : (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              无输入
            </div>
          )}
        </div>
        <div className="py-1">
          {outputs.length > 0 ? (
            outputs.map((s) => <SocketRow key={s.name} side="output" s={s} />)
          ) : (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              无输出
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

