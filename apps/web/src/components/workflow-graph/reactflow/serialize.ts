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

function str(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}

function arrayOrEmpty<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function emptyPersisted(): WorkflowGraphPersisted {
  return { nodes: [], links: [], viewport: null };
}

function parsePersistedNode(
  n: unknown,
): WorkflowGraphPersisted["nodes"][number] | null {
  if (!isRecord(n)) return null;
  const id = n.id;
  const type = n.type;
  if (typeof id !== "string" || typeof type !== "string") return null;
  const pos = n.pos;
  const px = Array.isArray(pos) ? num(pos[0]) : 0;
  const py = Array.isArray(pos) ? num(pos[1]) : 0;
  const params = n.params;
  return {
    id,
    type,
    label: str(n.label) ?? type,
    category: str(n.category),
    inputs: arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs),
    outputs: arrayOrEmpty<WorkflowSocketDefinition>(n.outputs),
    pos: [px, py],
    params: isRecord(params) ? params : {},
  };
}

function parsePersistedLink(l: unknown): WorkflowGraphLink | null {
  if (!isRecord(l)) return null;
  const { from_node, from_socket, to_node, to_socket, id } = l;
  if (
    typeof from_node !== "string" ||
    typeof from_socket !== "string" ||
    typeof to_node !== "string" ||
    typeof to_socket !== "string"
  ) {
    return null;
  }
  return {
    id: typeof id === "string" || id === null ? id : undefined,
    from_node,
    from_socket,
    to_node,
    to_socket,
  };
}

function parsePersistedViewport(raw: unknown): WorkflowGraphViewport | null {
  if (raw == null || !isRecord(raw)) return null;
  return {
    x: num(raw.x),
    y: num(raw.y),
    zoom: num(raw.zoom, 1),
  };
}

export function parsePersistedWorkflowGraphJson(
  json: string,
): WorkflowGraphPersisted {
  const trimmed = json.trim();
  if (!trimmed) return emptyPersisted();
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return emptyPersisted();
  }
  if (!isRecord(raw)) return emptyPersisted();

  const nodes = arrayOrEmpty(raw.nodes)
    .map(parsePersistedNode)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const links = arrayOrEmpty(raw.links)
    .map(parsePersistedLink)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    nodes,
    links,
    viewport: parsePersistedViewport(raw.viewport),
  };
}

function xyZoom(vp: { x: number; y: number; zoom: number }) {
  return { x: vp.x, y: vp.y, zoom: vp.zoom };
}

export function persistedViewportToReactFlowViewport(
  vp: WorkflowGraphViewport | null | undefined,
): Viewport | undefined {
  return vp ? xyZoom(vp) : undefined;
}

export function reactFlowViewportToPersistedViewport(
  vp: Viewport | null | undefined,
): WorkflowGraphViewport | null {
  return vp ? xyZoom(vp) : null;
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

export function toReactFlowEdges(persisted: WorkflowGraphPersisted): Edge[] {
  const appendableTargets = new Set<string>();
  for (const n of persisted.nodes) {
    for (const s of arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs)) {
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
      id:
        l.id ?? `${l.from_node}:${l.from_socket}->${l.to_node}:${l.to_socket}`,
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
    return {
      id: n.id,
      type: backendType,
      label: str(data.label) ?? backendType,
      category: str(data.category),
      inputs: arrayOrEmpty<WorkflowNodeInputSpec>(data.inputs),
      outputs: arrayOrEmpty<WorkflowSocketDefinition>(data.outputs),
      pos: [n.position.x, n.position.y],
      params: isRecord(data.params) ? data.params : {},
    };
  });

  const outLinks: WorkflowGraphLink[] = edges.flatMap((e) => {
    const { source: from_node, target: to_node } = e;
    if (!from_node || !to_node) return [];
    return [
      {
        id: e.id,
        from_node,
        from_socket: normalizeAppendableHandle(e.sourceHandle ?? ""),
        to_node,
        to_socket: normalizeAppendableHandle(e.targetHandle ?? ""),
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
