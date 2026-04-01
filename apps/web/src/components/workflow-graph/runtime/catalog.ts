import type { LGraph, LGraphNode } from "litegraph.js";

import { graphNodes } from "../litegraph";
import type {
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
  WorkflowStepProperties,
} from "../types";
import { readWorkflowNodeAccent } from "../workflow-graph-theme";

export function defaultWorkflowNodeColors(
  typeKey: string,
  cssRoot: HTMLElement | null,
): WorkflowNodeAccent {
  void typeKey;
  return readWorkflowNodeAccent(cssRoot);
}

export function reapplyAllWorkflowNodeColors(
  graph: LGraph,
  cssRoot: HTMLElement | null,
  nodeColors: (typeKey: string, el: HTMLElement | null) => WorkflowNodeAccent,
): void {
  const pick = (t: string) => nodeColors(t, cssRoot);
  for (const n of graphNodes(graph)) {
    const p = n.properties as WorkflowStepProperties;
    if (!p.backendType) continue;
    const accent = pick(p.backendType);
    n.color = accent.color;
    n.bgcolor = accent.bgcolor;
    n.boxcolor = accent.boxcolor;
  }
}

export function applyCatalogToNode(
  node: LGraphNode,
  def: WorkflowNodeTypeDefinition | undefined,
  nodeColors: (typeKey: string) => WorkflowNodeAccent,
): void {
  while (node.inputs?.length) {
    node.removeInput(node.inputs.length - 1);
  }
  while (node.outputs?.length) {
    node.removeOutput(node.outputs.length - 1);
  }
  const inputs = def?.inputs ?? [];
  const outputs = def?.outputs ?? [];
  for (const inp of inputs) {
    node.addInput(inp.name, "*");
  }
  for (const out of outputs) {
    node.addOutput(out.name, "*");
  }
  const p = node.properties as WorkflowStepProperties;
  p._catalogInputCount = inputs.length;
  node.title = def?.label ?? p.backendType ?? "node";
  const accent = nodeColors(p.backendType);
  node.color = accent.color;
  node.bgcolor = accent.bgcolor;
  node.boxcolor = accent.boxcolor;
  node.computeSize();
}

export function applyCatalogVisualToNode(
  node: LGraphNode,
  def: WorkflowNodeTypeDefinition | undefined,
  nodeColors: (typeKey: string) => WorkflowNodeAccent,
): void {
  const inputs = def?.inputs ?? [];
  const p = node.properties as WorkflowStepProperties;
  p._catalogInputCount = inputs.length;
  node.title = def?.label ?? p.backendType ?? "node";
  const accent = nodeColors(p.backendType);
  node.color = accent.color;
  node.bgcolor = accent.bgcolor;
  node.boxcolor = accent.boxcolor;
  node.computeSize();
}

export function cleanupExtraInputSlots(node: LGraphNode): void {
  const p = node.properties as WorkflowStepProperties;
  const base = p._catalogInputCount ?? 0;
  if (!node.inputs || node.inputs.length <= base) return;
  for (let i = node.inputs.length - 1; i >= base; i--) {
    if (node.inputs[i].link == null) {
      node.removeInput(i);
    }
  }
  node.computeSize();
}
