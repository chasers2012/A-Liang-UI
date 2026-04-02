import type { Edge, Node, Viewport } from "reactflow";

import type {
  WorkflowNodeInputSpec,
  WorkflowNodeTypeDefinition,
  WorkflowSocketDefinition,
} from "../types";
import type {
  WorkflowGraphLink,
  WorkflowGraphPersisted,
  WorkflowGraphViewport,
} from "./types";
import {
  appendableHandleId,
  normalizeAppendableHandle,
} from "./appendable-handle";

export const EMPTY_WORKFLOW_GRAPH_JSON =
  '{"nodes":[],"links":[],"viewport":null}';

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function num(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}

function safeInputs(x: unknown): WorkflowNodeInputSpec[] {
  return Array.isArray(x) ? (x as WorkflowNodeInputSpec[]) : [];
}

function safeOutputs(x: unknown): WorkflowSocketDefinition[] {
  return Array.isArray(x) ? (x as WorkflowSocketDefinition[]) : [];
}

export function parsePersistedWorkflowGraphJson(
  json: string,
): WorkflowGraphPersisted {
  const trimmed = json.trim();
  if (!trimmed) {
    return { nodes: [], links: [], viewport: null };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { nodes: [], links: [], viewport: null };
  }
  if (!isRecord(raw)) return { nodes: [], links: [], viewport: null };

  const nodesRaw = raw.nodes;
  const linksRaw = raw.links;
  const viewportRaw = raw.viewport;

  const nodes: WorkflowGraphPersisted["nodes"] = Array.isArray(nodesRaw)
    ? nodesRaw
        .map((n) => {
          if (!isRecord(n)) return null;
          const id = n.id;
          const type = n.type;
          const pos = n.pos;
          if (typeof id !== "string" || typeof type !== "string") return null;
          const px = Array.isArray(pos) ? num(pos[0]) : 0;
          const py = Array.isArray(pos) ? num(pos[1]) : 0;
          const params = n.params;
          const label = safeString(n.label) ?? type;
          const category = safeString(n.category);
          const inputs = safeInputs(n.inputs);
          const outputs = safeOutputs(n.outputs);
          return {
            id,
            type,
            label,
            category,
            inputs,
            outputs,
            pos: [px, py] as [number, number],
            params: isRecord(params) ? params : {},
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    : [];

  const links: WorkflowGraphLink[] = Array.isArray(linksRaw)
    ? linksRaw
        .map((l) => {
          if (!isRecord(l)) return null;
          const from_node = l.from_node;
          const from_socket = l.from_socket;
          const to_node = l.to_node;
          const to_socket = l.to_socket;
          if (
            typeof from_node !== "string" ||
            typeof from_socket !== "string" ||
            typeof to_node !== "string" ||
            typeof to_socket !== "string"
          ) {
            return null;
          }
          const id = l.id;
          return {
            id: typeof id === "string" || id === null ? id : undefined,
            from_node,
            from_socket,
            to_node,
            to_socket,
          } satisfies WorkflowGraphLink;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    : [];

  const viewport: WorkflowGraphViewport | null =
    viewportRaw == null
      ? null
      : isRecord(viewportRaw)
        ? {
            x: num(viewportRaw.x),
            y: num(viewportRaw.y),
            zoom: num(viewportRaw.zoom, 1),
          }
        : null;

  return { nodes, links, viewport };
}

export function persistedViewportToReactFlowViewport(
  vp: WorkflowGraphViewport | null | undefined,
): Viewport | undefined {
  if (!vp) return undefined;
  return { x: vp.x, y: vp.y, zoom: vp.zoom };
}

export function reactFlowViewportToPersistedViewport(
  vp: Viewport | null | undefined,
): WorkflowGraphViewport | null {
  if (!vp) return null;
  return { x: vp.x, y: vp.y, zoom: vp.zoom };
}

export function toReactFlowNodes(
  persisted: WorkflowGraphPersisted,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
): Node[] {
  return persisted.nodes.map((n) => {
    const def = catalog.get(n.type);
    return {
      id: n.id,
      type: "workflowStep",
      position: { x: num(n.pos[0]), y: num(n.pos[1]) },
      data: {
        backendType: n.type,
        label: def?.label ?? n.label ?? n.type,
        inputs: def?.inputs ?? n.inputs,
        outputs: def?.outputs ?? n.outputs,
        params: { ...(n.params ?? {}) },
      },
    } satisfies Node;
  });
}

function edgeIdFromLink(l: WorkflowGraphLink): string {
  const stable =
    l.id ?? `${l.from_node}:${l.from_socket}->${l.to_node}:${l.to_socket}`;
  return stable;
}

export function toReactFlowEdges(persisted: WorkflowGraphPersisted): Edge[] {
  const appendableTargets = new Set<string>();
  for (const n of persisted.nodes) {
    const inputs = Array.isArray(n.inputs) ? n.inputs : [];
    for (const s of inputs) {
      if (s?.render_type === "appendable") {
        appendableTargets.add(`${n.id}:${s.name}`);
      }
    }
  }
  const perSocketCounter = new Map<string, number>();
  return persisted.links.map((l) => {
    const targetKey = `${l.to_node}:${l.to_socket}`;
    let targetHandle = l.to_socket;
    if (appendableTargets.has(targetKey)) {
      const nth = (perSocketCounter.get(targetKey) ?? 0) + 1;
      perSocketCounter.set(targetKey, nth);
      targetHandle = appendableHandleId(l.to_socket, nth);
    }
    return {
      id: edgeIdFromLink(l),
      source: l.from_node,
      sourceHandle: l.from_socket,
      target: l.to_node,
      targetHandle,
      type: "default",
    } satisfies Edge;
  });
}

export function toPersistedWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport | null | undefined,
): WorkflowGraphPersisted {
  const outNodes: WorkflowGraphPersisted["nodes"] = nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const backendType =
      typeof data.backendType === "string" ? data.backendType : "node";
    const params = isRecord(data.params) ? data.params : {};
    const label = safeString(data.label) ?? backendType;
    const category = safeString(data.category);
    const inputs = safeInputs(data.inputs);
    const outputs = safeOutputs(data.outputs);
    return {
      id: n.id,
      type: backendType,
      label,
      category,
      inputs,
      outputs,
      pos: [n.position.x, n.position.y],
      params,
    };
  });

  const outLinks: WorkflowGraphLink[] = edges.flatMap((e) => {
    const from_node = e.source;
    const to_node = e.target;
    const from_socket = normalizeAppendableHandle(e.sourceHandle ?? "");
    const to_socket = normalizeAppendableHandle(e.targetHandle ?? "");
    if (!from_node || !to_node) return [];
    return [
      {
        id: e.id,
        from_node,
        from_socket,
        to_node,
        to_socket,
      } satisfies WorkflowGraphLink,
    ];
  });

  return {
    nodes: outNodes,
    links: outLinks,
    viewport: reactFlowViewportToPersistedViewport(viewport),
  };
}

export function stringifyPersistedWorkflowGraph(
  g: WorkflowGraphPersisted,
): string {
  return JSON.stringify({
    nodes: g.nodes ?? [],
    links: g.links ?? [],
    viewport: g.viewport ?? null,
  } satisfies WorkflowGraphPersisted);
}
