import {
  LiteGraph,
  LGraph,
  LGraphCanvas,
  type DragAndScale,
  type LGraphNode,
  type Vector4,
} from "litegraph.js";

import { buildNodeDisplayData } from "./graph-model";
import type {
  WorkflowGraphLink,
  WorkflowGraphNode,
  WorkflowGraphState,
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
  WorkflowGraphSelectedNode,
} from "./types";

export const LITEGRAPH_WORKFLOW_STEP_TYPE = "workflow_graph/step";

export type WorkflowStepProperties = {
  workflowNodeId: string;
  backendType: string;
  params: Record<string, unknown>;
};

function graphNodes(graph: LGraph): LGraphNode[] {
  return (graph as unknown as { _nodes: LGraphNode[] })._nodes;
}

type LGraphCanvasHiDpi = LGraphCanvas & {
  _qaDpr?: number;
  _qaOrigResize?: (width?: number, height?: number) => void;
  _qaOrigToCanvasContext?: DragAndScale["toCanvasContext"];
};

function clampDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5);
}

export function canvasCssPixelSize(canvas: HTMLCanvasElement): {
  w: number;
  h: number;
} {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (cw > 0 && ch > 0) {
    return { w: cw, h: ch };
  }
  const dpr = clampDevicePixelRatio();
  return {
    w: Math.max(1, Math.round(canvas.width / dpr)),
    h: Math.max(1, Math.round(canvas.height / dpr)),
  };
}

export function applyHiDpiToLGraphCanvas(lgc: LGraphCanvas): void {
  const c = lgc as LGraphCanvasHiDpi;
  if (c._qaOrigResize) return;

  c._qaOrigResize = lgc.resize.bind(lgc);
  lgc.resize = function (width?: number, height?: number) {
    const parent = this.canvas.parentNode as HTMLElement | null;
    const cssW = Math.max(1, width ?? parent?.offsetWidth ?? 1);
    const cssH = Math.max(1, height ?? parent?.offsetHeight ?? 1);
    const dpr = clampDevicePixelRatio();
    (this as LGraphCanvasHiDpi)._qaDpr = dpr;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width === bw && this.canvas.height === bh) {
      this.setDirty(true, true);
      return;
    }

    this.canvas.width = bw;
    this.canvas.height = bh;
    this.bgcanvas.width = bw;
    this.bgcanvas.height = bh;

    const fg = this.canvas.getContext("2d", { alpha: true });
    const bg = this.bgcanvas.getContext("2d", { alpha: true });
    if (!fg || !bg) {
      return;
    }
    this.ctx = fg;
    this.bgctx = bg;
    for (const ctx of [fg, bg]) {
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) {
        (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality =
          "high";
      }
    }

    this.setDirty(true, true);
  };

  const ds = lgc.ds;
  c._qaOrigToCanvasContext = ds.toCanvasContext.bind(ds);
  ds.toCanvasContext = function (ctx: CanvasRenderingContext2D) {
    const dpr = (lgc as LGraphCanvasHiDpi)._qaDpr ?? 1;
    if (dpr !== 1) {
      ctx.scale(dpr, dpr);
    }
    c._qaOrigToCanvasContext!(ctx);
  };

  ds.computeVisibleArea = function (viewport?: Vector4) {
    const el = this.element as HTMLCanvasElement | undefined;
    if (!el) {
      this.visible_area[0] = this.visible_area[1] = this.visible_area[2] =
        this.visible_area[3] = 0;
      return;
    }
    const { w: cssW, h: cssH } = canvasCssPixelSize(el);
    let width = cssW;
    let height = cssH;
    let startx = -this.offset[0];
    let starty = -this.offset[1];
    if (viewport) {
      startx += viewport[0] / this.scale;
      starty += viewport[1] / this.scale;
      width = viewport[2];
      height = viewport[3];
    }
    const endx = startx + width / this.scale;
    const endy = starty + height / this.scale;
    this.visible_area[0] = startx;
    this.visible_area[1] = starty;
    this.visible_area[2] = endx - startx;
    this.visible_area[3] = endy - starty;
  };

  lgc.centerOnNode = function (node: LGraphNode) {
    const { w: cssW, h: cssH } = canvasCssPixelSize(this.canvas);
    this.ds.offset[0] =
      -node.pos[0] - node.size[0] * 0.5 + (cssW * 0.5) / this.ds.scale;
    this.ds.offset[1] =
      -node.pos[1] - node.size[1] * 0.5 + (cssH * 0.5) / this.ds.scale;
    this.setDirty(true, true);
  };
}

let stepNodeRegistered = false;

export function defaultWorkflowNodeColors(typeKey: string): WorkflowNodeAccent {
  void typeKey;
  return { color: "#64748b", bgcolor: "#0f172a", boxcolor: "#475569" };
}

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
  }

  WorkflowGraphStep.title = "Workflow step";
  WorkflowGraphStep.prototype.onConnectInput = function (
    this: LGraphNode,
  ): boolean {
    const cfg = this.graph?.config as { workflowReadOnly?: boolean } | undefined;
    return !cfg?.workflowReadOnly;
  };
  WorkflowGraphStep.prototype.onConnectOutput = function (
    this: LGraphNode,
  ): boolean {
    const cfg = this.graph?.config as { workflowReadOnly?: boolean } | undefined;
    return !cfg?.workflowReadOnly;
  };

  LiteGraph.registerNodeType(
    LITEGRAPH_WORKFLOW_STEP_TYPE,
    WorkflowGraphStep as unknown as { new (): LGraphNode },
  );
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
  node.title = def?.label ?? p.backendType ?? "node";
  const accent = nodeColors(p.backendType);
  node.color = accent.color;
  node.bgcolor = accent.bgcolor;
  node.boxcolor = accent.boxcolor;
  node.computeSize();
}

export function loadWorkflowStateIntoGraph(
  graph: LGraph,
  state: WorkflowGraphState,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
  nodeColors: (typeKey: string) => WorkflowNodeAccent,
): Map<string, LGraphNode> {
  registerWorkflowStepNodeType();
  graph.clear();
  const uuidToNode = new Map<string, LGraphNode>();

  for (const n of state.nodes ?? []) {
    const node = LiteGraph.createNode(LITEGRAPH_WORKFLOW_STEP_TYPE);
    if (!node) continue;
    const p = node.properties as WorkflowStepProperties;
    p.workflowNodeId = n.id;
    p.backendType = n.type;
    p.params = { ...(n.params ?? {}) };
    node.pos[0] = n.pos[0];
    node.pos[1] = n.pos[1];
    applyCatalogToNode(node, catalog.get(n.type), nodeColors);
    graph.add(node);
    uuidToNode.set(n.id, node);
  }

  (state.links ?? []).forEach((l) => {
    const fromN = uuidToNode.get(l.from_node);
    const toN = uuidToNode.get(l.to_node);
    if (!fromN || !toN) return;
    const outIdx = fromN.outputs?.findIndex((o) => o.name === l.from_socket) ?? -1;
    const inIdx = toN.inputs?.findIndex((inp) => inp.name === l.to_socket) ?? -1;
    if (outIdx < 0 || inIdx < 0) return;
    try {
      fromN.connect(outIdx, toN, inIdx);
    } catch {
      /* duplicate or invalid */
    }
  });

  return uuidToNode;
}

function serializeGraphNodes(graph: LGraph): WorkflowGraphNode[] {
  const wNodes: WorkflowGraphNode[] = [];
  for (const n of graphNodes(graph)) {
    const p = n.properties as WorkflowStepProperties;
    if (!p.workflowNodeId || !p.backendType) continue;
    wNodes.push({
      id: p.workflowNodeId,
      type: p.backendType,
      pos: [n.pos[0], n.pos[1]],
      params: { ...(p.params ?? {}) },
    });
  }
  return wNodes;
}

function serializeGraphLinks(graph: LGraph): WorkflowGraphLink[] {
  const wLinks: WorkflowGraphLink[] = [];
  for (const key in graph.links) {
    const l = graph.links[Number(key)];
    if (!l) continue;
    const origin = graph.getNodeById(l.origin_id);
    const target = graph.getNodeById(l.target_id);
    if (!origin || !target) continue;
    const op = origin.properties as WorkflowStepProperties;
    const tp = target.properties as WorkflowStepProperties;
    if (!op.workflowNodeId || !tp.workflowNodeId) continue;
    const outName = origin.outputs?.[l.origin_slot]?.name ?? "";
    const inName = target.inputs?.[l.target_slot]?.name ?? "";
    const lid = String(l.id);
    wLinks.push({
      id: lid.startsWith("e-") ? undefined : lid,
      from_node: op.workflowNodeId,
      from_socket: outName,
      to_node: tp.workflowNodeId,
      to_socket: inName,
    });
  }
  return wLinks;
}

export function graphToWorkflowState(
  graph: LGraph,
  canvas: LGraphCanvas,
): WorkflowGraphState {
  const vp = {
    x: canvas.ds.offset[0] * canvas.ds.scale,
    y: canvas.ds.offset[1] * canvas.ds.scale,
    zoom: canvas.ds.scale,
  };
  return {
    nodes: serializeGraphNodes(graph),
    links: serializeGraphLinks(graph),
    viewport: vp,
  };
}

export function setCanvasViewport(
  canvas: LGraphCanvas,
  viewport: { x: number; y: number; zoom: number } | null | undefined,
): void {
  if (!viewport) {
    return;
  }
  const z = Math.max(0.08, Math.min(1.15, viewport.zoom || 1));
  canvas.ds.scale = z;
  canvas.ds.offset[0] = viewport.x / z;
  canvas.ds.offset[1] = viewport.y / z;
  canvas.setDirty(true, true);
}

const FIT_OPTS = { padding: 0.14, maxZoom: 1.15, minZoom: 0.08 };

export function fitWorkflowGraphView(
  canvas: LGraphCanvas,
  graph: LGraph,
  options: { padding: number; maxZoom: number; minZoom: number } = FIT_OPTS,
): void {
  const nodes = graphNodes(graph);
  const c = canvas.canvas;
  if (!nodes.length) {
    canvas.ds.reset();
    canvas.setDirty(true, true);
    return;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const bb = n.getBounding();
    minX = Math.min(minX, bb[0]);
    minY = Math.min(minY, bb[1]);
    maxX = Math.max(maxX, bb[0] + bb[2]);
    maxY = Math.max(maxY, bb[1] + bb[3]);
  }
  const gw = Math.max(maxX - minX, 80);
  const gh = Math.max(maxY - minY, 80);
  const { w: cssW, h: cssH } = canvasCssPixelSize(c);
  const mw = cssW * (1 - 2 * options.padding);
  const mh = cssH * (1 - 2 * options.padding);
  let scale = Math.min(mw / gw, mh / gh);
  scale = Math.min(
    options.maxZoom,
    Math.max(options.minZoom, scale),
  );
  canvas.ds.scale = scale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  canvas.ds.offset[0] = -cx + cssW / (2 * scale);
  canvas.ds.offset[1] = -cy + cssH / (2 * scale);
  canvas.setDirty(true, true);
}

export function findNodeByWorkflowId(
  graph: LGraph,
  workflowNodeId: string,
): LGraphNode | undefined {
  return graphNodes(graph).find(
    (n) => (n.properties as WorkflowStepProperties).workflowNodeId === workflowNodeId,
  );
}

export function liteGraphNodeToSelectedNode(
  node: LGraphNode,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
): WorkflowGraphSelectedNode | null {
  const p = node.properties as WorkflowStepProperties;
  if (!p.workflowNodeId || !p.backendType) return null;
  const wf: WorkflowGraphNode = {
    id: p.workflowNodeId,
    type: p.backendType,
    pos: [node.pos[0], node.pos[1]],
    params: { ...(p.params ?? {}) },
  };
  return {
    id: p.workflowNodeId,
    position: { x: node.pos[0], y: node.pos[1] },
    data: buildNodeDisplayData(wf, catalog),
  };
}

export function configureLiteGraphGlobals(): void {
  LiteGraph.CANVAS_GRID_SIZE = 12;
  LiteGraph.NODE_SLOT_HEIGHT = 18;
  LiteGraph.NODE_TITLE_HEIGHT = 26;
  LiteGraph.NODE_TEXT_SIZE = 13;
  LiteGraph.NODE_SUBTEXT_SIZE = 11;
}
