import type { LGraph, LGraphNode } from "litegraph.js";

export function graphNodes(graph: LGraph): LGraphNode[] {
  return (graph as unknown as { _nodes: LGraphNode[] })._nodes;
}
