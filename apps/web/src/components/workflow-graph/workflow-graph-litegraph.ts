import {
  LiteGraph,
  LGraph,
  LGraphCanvas,
  type DragAndScale,
  type LGraphNode,
  type LLink,
  type Vector4,
} from "litegraph.js";

import { buildNodeDisplayData } from "./graph-model";
import {
  readWorkflowLinkColor,
  readWorkflowLinkHighlightColor,
  readWorkflowNodeAccent,
  readWorkflowNodeShadowColor,
} from "./workflow-graph-theme";
import type {
  WorkflowGraphLink,
  WorkflowGraphNode,
  WorkflowGraphState,
  WorkflowGraphSelectedNode,
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
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

export function defaultWorkflowNodeColors(
  typeKey: string,
  cssRoot: HTMLElement | null,
): WorkflowNodeAccent {
  void typeKey;
  return readWorkflowNodeAccent(cssRoot);
}

/**
 * 明暗切换后根据当前 CSS 变量重算节点外观色（不重建插槽，避免断开已有连线）。
 * 连线色由 `applyWorkflowLiteGraphPaintFromCss` 写入 `default_link_color`。
 */
export function reapplyAllWorkflowNodeColors(
  graph: LGraph,
  _catalog: Map<string, WorkflowNodeTypeDefinition>,
  cssRoot: HTMLElement | null,
  nodeColors: (typeKey: string, el: HTMLElement | null) => WorkflowNodeAccent,
): void {
  void _catalog;
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
    /* 画布 allow_interaction=false（只读）时仍要能点选节点；LiteGraph 外层条件需此 flag */
    const ln = this as LGraphNode & {
      flags?: { allow_interaction?: boolean };
    };
    ln.flags = { ...ln.flags, allow_interaction: true };
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

export type WorkflowGraphRuntimeConfig = {
  workflowReadOnly?: boolean;
  align_to_grid?: boolean;
  /** 本应用 workflow 画布：禁用 LiteGraph 节点/画布/连线等自带右键菜单 */
  workflowCanvas?: boolean;
};

/**
 * `LGraph.clear()` 会把 `graph.config` 置为 `{}`，需在加载前后保留 workflow UI 开关（否则只读拦截如 `showLinkMenu` 会失效）。
 */
export function loadWorkflowStateIntoGraph(
  graph: LGraph,
  state: WorkflowGraphState,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
  nodeColors: (typeKey: string) => WorkflowNodeAccent,
  runtime?: WorkflowGraphRuntimeConfig,
): Map<string, LGraphNode> {
  registerWorkflowStepNodeType();
  const prev = graph.config as WorkflowGraphRuntimeConfig;
  const targetReadOnly = runtime?.workflowReadOnly ?? prev.workflowReadOnly;
  const targetAlign = runtime?.align_to_grid ?? prev.align_to_grid;
  const targetCanvas =
    runtime?.workflowCanvas ?? prev.workflowCanvas ?? true;
  graph.clear();
  /* `onConnectInput` / `onConnectOutput` 在只读时返回 false，会阻止 `connect()`；加载数据需临时允许连线 */
  graph.config = {
    ...graph.config,
    workflowReadOnly: false,
    align_to_grid: targetAlign,
    workflowCanvas: targetCanvas,
  };
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

  graph.config = {
    ...graph.config,
    workflowReadOnly: targetReadOnly,
    align_to_grid: targetAlign,
    workflowCanvas: targetCanvas,
  };

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

/** 浏览器视口坐标 → LiteGraph 图坐标（与 `adjustMouseEvent` / `canvasX` 一致）。 */
export function clientToGraphCoords(
  lgc: LGraphCanvas,
  clientX: number,
  clientY: number,
): [number, number] {
  const b = lgc.canvas.getBoundingClientRect();
  const x = clientX - b.left;
  const y = clientY - b.top;
  const out = lgc.convertCanvasToOffset([x, y]);
  return [out[0], out[1]];
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
  patchLGraphRenderLinkHighlightColor();
  patchLGraphCanvasReadOnlyMouseGuards();
  patchLGraphShowLinkMenuWhenWorkflowCanvas();
  patchLGraphProcessContextMenuWhenWorkflowCanvas();
}

function workflowCanvasSuppressesLiteGraphMenus(
  graph: LGraph | null | undefined,
): boolean {
  return Boolean(
    (graph?.config as WorkflowGraphRuntimeConfig | undefined)?.workflowCanvas,
  );
}

let processContextMenuWorkflowPatch = false;

/** `graph.config.workflowCanvas` 时禁用画布/节点/插槽等全部 LiteGraph 右键菜单 */
function patchLGraphProcessContextMenuWhenWorkflowCanvas(): void {
  if (processContextMenuWorkflowPatch) return;
  processContextMenuWorkflowPatch = true;
  const original = LGraphCanvas.prototype.processContextMenu;
  LGraphCanvas.prototype.processContextMenu = function (
    this: LGraphCanvas,
    node: LGraphNode | null,
    event: Event,
  ) {
    if (workflowCanvasSuppressesLiteGraphMenus(this.graph)) {
      return;
    }
    return original.call(this, node as LGraphNode, event);
  };
}

let showLinkMenuWorkflowPatch = false;

/** workflow 画布上禁用连线中点右键菜单 */
function patchLGraphShowLinkMenuWhenWorkflowCanvas(): void {
  if (showLinkMenuWorkflowPatch) return;
  showLinkMenuWorkflowPatch = true;
  const original = LGraphCanvas.prototype.showLinkMenu;
  LGraphCanvas.prototype.showLinkMenu = function (
    this: LGraphCanvas,
    link: LLink,
    e: unknown,
  ) {
    if (workflowCanvasSuppressesLiteGraphMenus(this.graph)) {
      return false;
    }
    return original.call(this, link, e);
  };
}

let readOnlyMouseGuardsPatched = false;

/** 只读时禁止 Ctrl+拖出框选矩形（LiteGraph 未检查 read_only） */
function patchLGraphCanvasReadOnlyMouseGuards(): void {
  if (readOnlyMouseGuardsPatched) return;
  readOnlyMouseGuardsPatched = true;
  const original = LGraphCanvas.prototype.processMouseDown;
  LGraphCanvas.prototype.processMouseDown = function (this: LGraphCanvas, e) {
    const ret = original.call(this, e);
    const ro = Boolean(
      (this.graph?.config as { workflowReadOnly?: boolean } | undefined)
        ?.workflowReadOnly,
    );
    const me = e as MouseEvent & { which?: number };
    if (ro && this.dragging_rectangle && me.ctrlKey && me.which === 1) {
      this.dragging_rectangle = null;
    }
    return ret;
  };
}

type LiteGraphWithHighlight = typeof LiteGraph & {
  WORKFLOW_LINK_HIGHLIGHT_COLOR?: string;
};

let renderLinkHighlightPatched = false;

/**
 * LiteGraph 在 `highlighted_links` 时把连线强制设为 #FFF；与亮色画布冲突。
 * 通过短暂摘掉高亮标记并传入主题色，绕过内部写死颜色。
 */
function patchLGraphRenderLinkHighlightColor(): void {
  if (renderLinkHighlightPatched) return;
  renderLinkHighlightPatched = true;

  const original = LGraphCanvas.prototype.renderLink as unknown as (
    this: LGraphCanvas,
    ...args: unknown[]
  ) => void;
  if (typeof original !== "function") return;

  /* 运行时签名为 (ctx, a, b, link, …)；litegraph.d.ts 省略了 ctx */
  LGraphCanvas.prototype.renderLink = function (
    this: LGraphCanvas,
    ...args: unknown[]
  ) {
    const link = args[3] as { id?: number | string } | null | undefined;
    const hl = (LiteGraph as LiteGraphWithHighlight).WORKFLOW_LINK_HIGHLIGHT_COLOR;
    const hid = link?.id;
    const map = this.highlighted_links as Record<string, boolean> | undefined;
    if (link != null && hl && hid != null && map?.[hid]) {
      const saved = { ...map };
      delete map[hid];
      const next = [...args];
      next[6] = hl;
      const out = original.apply(this, next);
      Object.assign(map, saved);
      return out;
    }
    return original.apply(this, args);
  } as unknown as typeof LGraphCanvas.prototype.renderLink;
}

function readCssVar(root: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

/** litegraph 类型声明未列出的运行时字段 */
type LiteGraphPaintGlobals = typeof LiteGraph & {
  NODE_SELECTED_TITLE_COLOR: string;
  NODE_BOX_OUTLINE_COLOR: string;
};

const LG = LiteGraph as LiteGraphPaintGlobals;

/**
 * 将 `.workflow-graph-canvas-root` 上的 CSS 变量同步到 LiteGraph 静态色与当前 LGraphCanvas 实例（标题/正文/连线/插槽）。
 */
export function applyWorkflowLiteGraphPaintFromCss(
  root: HTMLElement,
  canvas: LGraphCanvas | null,
): void {
  const r = (root.closest(".workflow-graph-canvas-root") ?? root) as HTMLElement;
  const fg = readCssVar(r, "--foreground", "#18181b");
  const mf = readCssVar(r, "--muted-foreground", "#71717a");
  const pf = readCssVar(r, "--primary-foreground", "#fafafa");
  const ring = readCssVar(r, "--ring", "#a1a1aa");
  const primary = readCssVar(r, "--primary", "#18181b");
  const link = readWorkflowLinkColor(r);

  const titleText = readCssVar(
    r,
    "--lg-node-title-text",
    readCssVar(r, "--lg-node-title", fg),
  );
  const bodyText = readCssVar(r, "--lg-node-body-text", mf);
  const selTitle = readCssVar(r, "--lg-node-selected-title", pf);
  const outline = readCssVar(r, "--lg-node-outline", ring);
  const connecting = readCssVar(r, "--lg-link-connecting", link);
  const eventLink = readCssVar(r, "--lg-link-event", primary);

  const sockOff = readCssVar(r, "--lg-socket-off", mf);
  const sockOn = readCssVar(r, "--lg-socket-on", primary);

  LiteGraph.NODE_TITLE_COLOR = titleText;
  LiteGraph.NODE_TEXT_COLOR = bodyText;
  LG.NODE_SELECTED_TITLE_COLOR = selTitle;
  LG.NODE_BOX_OUTLINE_COLOR = outline;
  LiteGraph.DEFAULT_SHADOW_COLOR = readWorkflowNodeShadowColor(r);
  LiteGraph.LINK_COLOR = link;
  LiteGraph.CONNECTING_LINK_COLOR = connecting;
  LiteGraph.EVENT_LINK_COLOR = eventLink;
  (LiteGraph as LiteGraphWithHighlight).WORKFLOW_LINK_HIGHLIGHT_COLOR =
    readWorkflowLinkHighlightColor(r);

  if (canvas) {
    canvas.node_title_color = titleText;
    canvas.default_link_color = link;
    canvas.default_connection_color = {
      input_off: sockOff,
      input_on: sockOn,
      output_off: sockOff,
      output_on: sockOn,
    };
    canvas.title_text_font = `${LiteGraph.NODE_TEXT_SIZE}px Arial`;
    canvas.inner_text_font = `normal ${LiteGraph.NODE_SUBTEXT_SIZE}px Arial`;
  }
}

let contextMenuWheelFixRefCount = 0;
let contextMenuWheelFixHandler: ((e: WheelEvent) => void) | null = null;

/**
 * LiteGraph 在 `.litegraph.litecontextmenu` 根上监听 wheel 且 `preventDefault()`，
 * 用 `style.top` 做伪滚动；与 `overflow-y: auto` + `max-height` 冲突导致无法滚动。
 * 在 document 捕获阶段先处理：对菜单根做 `scrollTop`，并 `stopPropagation` 避免传到 LiteGraph。
 */
export function installLiteGraphContextMenuScrollFix(): () => void {
  if (typeof document === "undefined") return () => {};

  if (contextMenuWheelFixRefCount === 0) {
    contextMenuWheelFixHandler = (e: WheelEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const menu = t.closest(".litegraph.litecontextmenu");
      if (!menu) return;
      e.preventDefault();
      e.stopPropagation();
      if (menu.scrollHeight > menu.clientHeight + 1) {
        menu.scrollTop += e.deltaY;
      }
    };
    document.addEventListener("wheel", contextMenuWheelFixHandler, {
      capture: true,
      passive: false,
    });
  }
  contextMenuWheelFixRefCount += 1;

  return () => {
    contextMenuWheelFixRefCount -= 1;
    if (contextMenuWheelFixRefCount <= 0 && contextMenuWheelFixHandler) {
      document.removeEventListener("wheel", contextMenuWheelFixHandler, {
        capture: true,
      });
      contextMenuWheelFixRefCount = 0;
      contextMenuWheelFixHandler = null;
    }
  };
}
