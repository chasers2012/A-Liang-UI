import type { LGraph, LGraphCanvas, LGraphNode } from "litegraph.js";

import { graphNodes } from "../litegraph";
import type {
  WorkflowGraphRuntimeConfig,
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
  WorkflowStepProperties,
} from "../types";
import { applyCatalogVisualToNode } from "./catalog";
import {
  EMPTY_LITEGRAPH_GRAPH_JSON,
  WORKFLOW_GRAPH_EXTRA_SCHEMA_VERSION,
} from "./constants";
import { registerWorkflowStepNodeType } from "./step";

function readRuntimeTargets(
  graph: LGraph,
  runtime?: WorkflowGraphRuntimeConfig,
): { interactionReadOnly: boolean; align_to_grid: boolean | undefined } {
  const prev = graph.config as WorkflowGraphRuntimeConfig;
  return {
    interactionReadOnly:
      runtime?.interactionReadOnly ?? prev.interactionReadOnly ?? false,
    align_to_grid: runtime?.align_to_grid ?? prev.align_to_grid,
  };
}

function readViewportFromSerializedExtra(
  ser: Record<string, unknown>,
): { x: number; y: number; zoom: number } | null {
  const ex = ser.extra;
  if (!ex || typeof ex !== "object") return null;
  const vp = (ex as Record<string, unknown>).viewport;
  if (!vp || typeof vp !== "object") return null;
  const r = vp as Record<string, unknown>;
  if (
    typeof r.x !== "number" ||
    typeof r.y !== "number" ||
    typeof r.zoom !== "number"
  ) {
    return null;
  }
  return { x: r.x, y: r.y, zoom: r.zoom };
}

export function parseAndValidateLiteGraphGraphJson(
  json: string,
): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("工作流图 JSON 无法解析");
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("工作流图须为 JSON 对象");
  }
  return raw as Record<string, unknown>;
}

export function loadWorkflowJsonIntoGraph(
  graph: LGraph,
  json: string,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
  nodeColors: (typeKey: string) => WorkflowNodeAccent,
  runtime?: WorkflowGraphRuntimeConfig,
): Map<string, LGraphNode> {
  registerWorkflowStepNodeType();
  const { interactionReadOnly, align_to_grid } = readRuntimeTargets(
    graph,
    runtime,
  );
  graph.clear();
  graph.config = {
    ...graph.config,
    interactionReadOnly: false,
    align_to_grid,
  };

  const trimmed = json.trim();
  const parsed = parseAndValidateLiteGraphGraphJson(
    trimmed.length > 0 ? trimmed : EMPTY_LITEGRAPH_GRAPH_JSON,
  );
  graph.configure(parsed);

  const uuidToNode = new Map<string, LGraphNode>();
  for (const node of graphNodes(graph)) {
    const p = node.properties as WorkflowStepProperties;
    if (!p.workflowNodeId || !p.backendType) continue;
    applyCatalogVisualToNode(node, catalog.get(p.backendType), nodeColors);
    uuidToNode.set(p.workflowNodeId, node);
  }

  graph.config = {
    ...graph.config,
    interactionReadOnly,
    align_to_grid,
  };

  return uuidToNode;
}

export function getViewportFromLiteGraphSerializedJson(
  json: string,
): { x: number; y: number; zoom: number } | null {
  try {
    const parsed = parseAndValidateLiteGraphGraphJson(json);
    return readViewportFromSerializedExtra(parsed);
  } catch {
    return null;
  }
}

const EPHEMERAL_CONFIG_KEYS = new Set([
  "interactionReadOnly",
  "suppressContextMenus",
]);

export function graphToSerializedJson(
  graph: LGraph,
  canvas: LGraphCanvas,
): string {
  const ser = graph.serialize() as Record<string, unknown>;
  const rawCfg = ser.config;
  if (rawCfg && typeof rawCfg === "object" && !Array.isArray(rawCfg)) {
    const cfg = { ...(rawCfg as Record<string, unknown>) };
    for (const k of EPHEMERAL_CONFIG_KEYS) {
      delete cfg[k];
    }
    ser.config = cfg;
  }
  const prevExtra =
    typeof ser.extra === "object" && ser.extra !== null
      ? (ser.extra as Record<string, unknown>)
      : {};
  ser.extra = {
    ...prevExtra,
    qa_schema_version: WORKFLOW_GRAPH_EXTRA_SCHEMA_VERSION,
    viewport: {
      x: canvas.ds.offset[0] * canvas.ds.scale,
      y: canvas.ds.offset[1] * canvas.ds.scale,
      zoom: canvas.ds.scale,
    },
  };
  return JSON.stringify(ser);
}
