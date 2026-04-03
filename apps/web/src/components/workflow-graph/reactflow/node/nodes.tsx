import { memo, useCallback } from "react";
import {

  useReactFlow,
  type NodeProps,
} from "reactflow";

import { cn } from "@/lib/utils";
import {
  ParamRow,
  nodeParamEffectiveValue,
} from "./param-row";
import { useWorkflowGraphContext } from "../../workflow-graph-context";
import type { WorkflowNodeInputSpec, WorkflowSocketDefinition } from "../../types";
import {
  inputSpecToNodeParamModel,
  isWireInputSpec,
} from "../../workflow-node-input-spec";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SocketRow } from "./socket-row";


export type WorkflowStepNodeData = {
  backendType: string;
  label: string;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
  params: Record<string, unknown>;
};


export const WorkflowStepNode = memo(function WorkflowStepNode(
  props: NodeProps<WorkflowStepNodeData>,
) {
  const { id, data, selected } = props;
  const inputs = data.inputs ?? [];
  const outputs = data.outputs ?? [];
  const wireInputs = inputs.filter(isWireInputSpec);
  const inlineInputSpecs = inputs.filter((s) => !isWireInputSpec(s));
  const { readOnly } = useWorkflowGraphContext();
  const { setNodes } = useReactFlow();

  const onParamChange = useCallback(
    (key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== id) return node;
          const d = node.data as WorkflowStepNodeData;
          return {
            ...node,
            data: {
              ...d,
              params: { ...d.params, [key]: value },
            },
          };
        }),
      );
    },
    [id, setNodes],
  );

  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[min(320px,92vw)] rounded-lg border bg-popover/95 text-popover-foreground shadow-sm backdrop-blur",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-5">
            {data.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0">
        <div className="border-r border-border/60 py-1">
          {wireInputs.length > 0
            ? wireInputs.map((s) => (
              <SocketRow
                key={s.name}
                nodeId={id}
                side="input"
                socket={s}
                readOnly={readOnly}
              />
            ))
            : null}
        </div>
        <div className="py-1">
          {outputs.length > 0 ? (
            outputs.map((s) => (
              <SocketRow
                key={s.name}
                side="output"
                nodeId={id}
                socket={s}
                readOnly={readOnly}
              />
            ))
          ) : null}
        </div>
      </div>

      {inlineInputSpecs.length > 0 ? (
        <ScrollArea className="nodrag nopan space-y-2 overflow-y-auto border-t border-border/80 px-2.5 py-2 max-h-[min(240px,40vh)]">
          <div className="flex flex-col gap-2">
            {inlineInputSpecs.map((raw) => {
              const spec = inputSpecToNodeParamModel(raw);
              return (
                <ParamRow
                  key={spec.key}
                  spec={spec}
                  readOnly={readOnly}
                  value={nodeParamEffectiveValue(data.params, spec)}
                  onChange={(v) => onParamChange(spec.key, v)}
                />
              );
            })}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
});
