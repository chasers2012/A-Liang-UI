import { LiteGraph, type LGraphNode } from "litegraph.js";

import type { WorkflowStepProperties } from "../types";
import { LITEGRAPH_WORKFLOW_STEP_TYPE } from "./constants";

let stepNodeRegistered = false;

export function registerWorkflowStepNodeType(): void {
  if (stepNodeRegistered) return;
  stepNodeRegistered = true;

  function WorkflowGraphStep(this: LGraphNode) {
    this.properties = {
      workflowNodeId: "",
      backendType: "",
      params: {},
    } as WorkflowStepProperties;
    this.size = [200, 72];
    this.mode = LiteGraph.NEVER;
    const ln = this as LGraphNode & {
      flags?: { allow_interaction?: boolean };
    };
    ln.flags = { ...ln.flags, allow_interaction: true };
  }

  WorkflowGraphStep.title = "Workflow step";
  WorkflowGraphStep.prototype.onConnectInput = function (
    this: LGraphNode,
  ): boolean {
    const cfg = this.graph?.config as
      | { interactionReadOnly?: boolean }
      | undefined;
    return !cfg?.interactionReadOnly;
  };
  WorkflowGraphStep.prototype.onConnectOutput = function (
    this: LGraphNode,
  ): boolean {
    const cfg = this.graph?.config as
      | { interactionReadOnly?: boolean }
      | undefined;
    return !cfg?.interactionReadOnly;
  };

  WorkflowGraphStep.prototype.onBeforeConnectInput = function (
    this: LGraphNode,
    targetSlot: number,
  ): number {
    const input = this.inputs?.[targetSlot];
    if (!input || input.link == null) return targetSlot;
    const name = input.name;
    for (let i = 0; i < (this.inputs?.length ?? 0); i++) {
      if (this.inputs![i].name === name && this.inputs![i].link == null) {
        return i;
      }
    }
    this.addInput(name, "*");
    return this.inputs!.length - 1;
  };

  LiteGraph.registerNodeType(
    LITEGRAPH_WORKFLOW_STEP_TYPE,
    WorkflowGraphStep as unknown as { new (): LGraphNode },
  );
}
