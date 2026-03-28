"use client";

import { LiteGraph, LGraph, LGraphCanvas } from "litegraph.js";
import "litegraph.js/css/litegraph.css";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

import { catalogToMap } from "./graph-model";
import type {
  WorkflowGraphSelectedNode,
  WorkflowGraphState,
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
} from "./types";
import { readWorkflowGridDotColor } from "./workflow-graph-theme";
import {
  applyCatalogToNode,
  applyHiDpiToLGraphCanvas,
  applyWorkflowLiteGraphPaintFromCss,
  cleanupExtraInputSlots,
  configureLiteGraphGlobals,
  defaultWorkflowNodeColors,
  findNodeByWorkflowId,
  fitWorkflowGraphView,
  graphToWorkflowState,
  liteGraphNodeToSelectedNode,
  loadWorkflowStateIntoGraph,
  LITEGRAPH_WORKFLOW_STEP_TYPE,
  reapplyAllWorkflowNodeColors,
  registerWorkflowStepNodeType,
  setCanvasViewport,
  clientToGraphCoords,
  installLiteGraphContextMenuScrollFix,
} from "./workflow-graph-litegraph";

import "./workflow-graph-canvas.css";

const DEFAULT_FIT = { padding: 0.14, maxZoom: 1.15, minZoom: 0.08 };

/** 左侧「添加节点」拖到画布时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const WORKFLOW_GRAPH_NODE_DRAG_MIME =
  "application/x-workflow-graph-node-type";

/** LiteGraph 画布上有、但类型声明未列出的字段 */
type LGraphCanvasChrome = LGraphCanvas & {
  read_only: boolean;
  allow_interaction: boolean;
};

function shouldBlockProcessKeyInWorkflowReadOnly(e: KeyboardEvent): boolean {
  if (e.keyCode === 46 || e.keyCode === 8) return true;
  if (e.ctrlKey || e.metaKey) {
    const k = e.keyCode;
    if (k === 65 || k === 67 || k === 86 || k === 88) return true;
  }
  return false;
}

export type WorkflowGraphInspectorRenderContext = {
  readOnly: boolean;
  selectedNode: WorkflowGraphSelectedNode | null;
  patchNodeParam: (key: string, value: unknown) => void;
  deleteSelectedNode: () => void;
};

export type WorkflowGraphCanvasHandle = {
  getGraph: () => WorkflowGraphState;
  importGraph: (g: WorkflowGraphState) => void;
};

export type WorkflowGraphCanvasProps = {
  nodeTypes: WorkflowNodeTypeDefinition[];
  initialGraph: WorkflowGraphState;
  readOnly?: boolean;
  /** 点阵间距（图坐标）。 */
  dotGridGap?: number;
  fitViewOptions?: { padding: number; maxZoom: number; minZoom: number };
  className?: string;
  /** 包住 canvas + 缩放条的外层（渐变边框等） */
  canvasAreaClassName?: string;
  /**
   * 节点配色；颜色请在 `workflow-graph-canvas.css` 的 `--lg-node-*` 上定义，
   * `cssRoot` 为画布内层容器（用于 `closest('.workflow-graph-canvas-root')`）。
   */
  nodeColors?: (
    typeKey: string,
    cssRoot: HTMLElement | null,
  ) => WorkflowNodeAccent;
  /** 自定义左侧「添加节点」区；不传且非只读时用 `nodeTypes` 生成按钮列表。 */
  renderPalette?: (ctx: {
    addNode: (
      typeKey: string,
      graphPos?: readonly [number, number],
    ) => void;
  }) => ReactNode;
  /** 右侧/底部属性区；不传则不渲染。 */
  renderInspector?: (ctx: WorkflowGraphInspectorRenderContext) => ReactNode;
};

type GraphRuntime = {
  graph: LGraph;
  canvas: LGraphCanvas;
};

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  visible: readonly [number, number, number, number],
  gap: number,
  dotColor: string,
) {
  const [vx, vy, vw, vh] = visible;
  const startX = Math.floor(vx / gap) * gap;
  const startY = Math.floor(vy / gap) * gap;
  ctx.fillStyle = dotColor;
  ctx.globalAlpha = 0.55;
  for (let x = startX; x < vx + vw; x += gap) {
    for (let y = startY; y < vy + vh; y += gap) {
      ctx.fillRect(x, y, 1.1, 1.1);
    }
  }
  ctx.globalAlpha = 1;
}

const WorkflowGraphCanvasInner = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(function WorkflowGraphCanvasInner(
  {
    nodeTypes,
    initialGraph,
    readOnly = false,
    dotGridGap = 22,
    fitViewOptions = DEFAULT_FIT,
    className,
    canvasAreaClassName,
    nodeColors = defaultWorkflowNodeColors,
    renderPalette,
    renderInspector,
  },
  ref,
) {
  const catMap = useMemo(() => catalogToMap(nodeTypes), [nodeTypes]);
  const catMapRef = useRef(catMap);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GraphRuntime | null>(null);
  const readOnlyRef = useRef(readOnly);
  const initialGraphRef = useRef(initialGraph);
  const nodeColorsRef = useRef(
    nodeColors ?? defaultWorkflowNodeColors,
  );
  const fitOptsRef = useRef(fitViewOptions);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    catMapRef.current = catMap;
  }, [catMap]);

  useEffect(() => installLiteGraphContextMenuScrollFix(), []);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    nodeColorsRef.current = nodeColors ?? defaultWorkflowNodeColors;
  }, [nodeColors]);

  useEffect(() => {
    fitOptsRef.current = fitViewOptions;
  }, [fitViewOptions]);

  useEffect(() => {
    initialGraphRef.current = initialGraph;
  }, [initialGraph]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorNode, setInspectorNode] =
    useState<WorkflowGraphSelectedNode | null>(null);

  const syncSelectionFromCanvas = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const sel = rt.canvas.selected_nodes;
    const ids = Object.keys(sel);
    if (ids.length === 0) {
      setSelectedId(null);
      setInspectorNode(null);
      return;
    }
    const last = sel[Number(ids[ids.length - 1])];
    const p = last?.properties as { workflowNodeId?: string };
    const wid = p?.workflowNodeId ?? null;
    setSelectedId(wid);
    setInspectorNode(
      last && wid ? liteGraphNodeToSelectedNode(last, catMap) : null,
    );
  }, [catMap]);

  useEffect(() => {
    configureLiteGraphGlobals();
    registerWorkflowStepNodeType();

    const canvasEl = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvasEl || !wrap) return;

    const graph = new LGraph();
    graph.config = {
      ...(graph.config ?? {}),
      workflowCanvas: true,
      align_to_grid: !readOnlyRef.current,
      workflowReadOnly: readOnlyRef.current,
    };

    const graphCanvas = new LGraphCanvas(canvasEl, graph, {
      autoresize: true,
    });

    applyHiDpiToLGraphCanvas(graphCanvas);

    graphCanvas.background_image = "";
    graphCanvas.clear_background = true;
    (
      graphCanvas as unknown as { clear_background_color: string }
    ).clear_background_color = "transparent";
    graphCanvas.links_render_mode = LiteGraph.SPLINE_LINK;
    graphCanvas.connections_width = 2;
    graphCanvas.allow_searchbox = false;
    graphCanvas.allow_dragnodes = !readOnlyRef.current;
    graphCanvas.allow_reconnect_links = !readOnlyRef.current;
    /* 不用 read_only：会跳过整段节点 mousedown，只读时无法点选节点看属性 */
    const canvasChrome = graphCanvas as LGraphCanvasChrome;
    canvasChrome.read_only = false;
    canvasChrome.allow_interaction = !readOnlyRef.current;
    graphCanvas.multi_select = false;
    graphCanvas.show_info = false;
    graphCanvas.render_canvas_border = false;
    graphCanvas.render_connections_border = false;
    graphCanvas.render_connections_shadows = false;
    graphCanvas.render_shadows = true;

    applyWorkflowLiteGraphPaintFromCss(wrap, graphCanvas);

    graphCanvas.onDrawBackground = (ctx, visible) => {
      drawDotGrid(ctx, visible, dotGridGap, readWorkflowGridDotColor(wrap));
    };

    const baseProcessKey = graphCanvas.processKey.bind(graphCanvas);
    graphCanvas.processKey = function (e: KeyboardEvent) {
      const g = graph;
      const ro = Boolean(
        (g.config as { workflowReadOnly?: boolean })?.workflowReadOnly,
      );
      if (ro && e.type === "keydown") {
        const t = e.target as HTMLElement;
        if (
          t?.localName !== "input" &&
          t?.localName !== "textarea" &&
          shouldBlockProcessKeyInWorkflowReadOnly(e)
        ) {
          e.preventDefault();
          return false;
        }
      }
      return baseProcessKey(e);
    };

    graphCanvas.onSelectionChange = () => {
      syncSelectionFromCanvas();
    };

    graph.onNodeConnectionChange = (
      _kind: number,
      node: unknown,
    ) => {
      if (node && typeof node === "object" && "inputs" in node) {
        cleanupExtraInputSlots(node as import("litegraph.js").LGraphNode);
      }
    };

    runtimeRef.current = { graph, canvas: graphCanvas };

    const ro = new ResizeObserver(() => {
      graphCanvas.resize();
      graphCanvas.setDirty(true, true);
    });
    ro.observe(wrap);

    loadWorkflowStateIntoGraph(
      graph,
      initialGraphRef.current,
      catMap,
      (t) => nodeColorsRef.current(t, wrap),
      {
        workflowCanvas: true,
        workflowReadOnly: readOnlyRef.current,
        align_to_grid: !readOnlyRef.current,
      },
    );
    requestAnimationFrame(() => {
      graphCanvas.resize();
      applyWorkflowLiteGraphPaintFromCss(wrap, graphCanvas);
      const g0 = initialGraphRef.current;
      if (g0.viewport) {
        setCanvasViewport(graphCanvas, g0.viewport);
      } else {
        fitWorkflowGraphView(graphCanvas, graph, fitOptsRef.current);
      }
      graphCanvas.setDirty(true, true);
    });

    return () => {
      ro.disconnect();
      graphCanvas.stopRendering();
      graphCanvas.unbindEvents();
      graph.detachCanvas(graphCanvas);
      graph.clear();
      runtimeRef.current = null;
    };
  }, [catMap, syncSelectionFromCanvas, dotGridGap]);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    rt.graph.config = {
      ...(rt.graph.config ?? {}),
      workflowCanvas: true,
      align_to_grid: !readOnly,
      workflowReadOnly: readOnly,
    };
    rt.canvas.allow_dragnodes = !readOnly;
    rt.canvas.allow_reconnect_links = !readOnly;
    const c = rt.canvas as LGraphCanvasChrome;
    c.read_only = false;
    c.allow_interaction = !readOnly;
  }, [readOnly]);

  const syncCanvasThemeFromDom = useCallback(() => {
    const wrap = wrapRef.current;
    const rt = runtimeRef.current;
    if (!wrap || !rt) return;
    reapplyAllWorkflowNodeColors(
      rt.graph,
      catMapRef.current,
      wrap,
      (t, el) => nodeColorsRef.current(t, el),
    );
    applyWorkflowLiteGraphPaintFromCss(wrap, rt.canvas);
    rt.canvas.setDirty(true, true);
  }, []);

  /**
   * html `class` 在 next-themes 里异步更新，双 rAF + MutationObserver 后再读 CSS 变量。
   */
  useLayoutEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const scheduleSync = () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          syncCanvasThemeFromDom();
        });
      });
    };

    scheduleSync();

    const el = document.documentElement;
    const mo = new MutationObserver(() => {
      scheduleSync();
    });
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [resolvedTheme, nodeColors, syncCanvasThemeFromDom]);

  const getGraph = useCallback((): WorkflowGraphState => {
    const rt = runtimeRef.current;
    if (!rt) {
      return { nodes: [], links: [], viewport: null };
    }
    return graphToWorkflowState(rt.graph, rt.canvas);
  }, []);

  const importGraph = useCallback(
    (g: WorkflowGraphState) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      const wrap = wrapRef.current;
      loadWorkflowStateIntoGraph(rt.graph, g, catMap, (t) =>
        nodeColorsRef.current(t, wrap),
        {
          workflowCanvas: true,
          workflowReadOnly: readOnlyRef.current,
          align_to_grid: !readOnlyRef.current,
        },
      );
      if (wrap) {
        applyWorkflowLiteGraphPaintFromCss(wrap, rt.canvas);
      }
      setSelectedId(null);
      setInspectorNode(null);
      requestAnimationFrame(() => {
        rt.canvas.resize();
        if (g.viewport) {
          setCanvasViewport(rt.canvas, g.viewport);
        } else {
          fitWorkflowGraphView(rt.canvas, rt.graph, fitOptsRef.current);
        }
        rt.canvas.setDirty(true, true);
      });
    },
    [catMap],
  );

  useImperativeHandle(ref, () => ({ getGraph, importGraph }), [
    getGraph,
    importGraph,
  ]);

  const patchNodeParam = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId) return;
      const rt = runtimeRef.current;
      if (!rt) return;
      const n = findNodeByWorkflowId(rt.graph, selectedId);
      if (!n) return;
      const p = n.properties as { params: Record<string, unknown> };
      const next = { ...p.params };
      if (value === "" || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      p.params = next;
      rt.graph.setDirtyCanvas(true, true);
      setInspectorNode(liteGraphNodeToSelectedNode(n, catMap));
    },
    [selectedId, catMap],
  );

  const addNode = useCallback(
    (typeKey: string, graphPos?: readonly [number, number]) => {
      const rt = runtimeRef.current;
      if (!rt || readOnly) return;
      const id = crypto.randomUUID();
      registerWorkflowStepNodeType();
      const node = LiteGraph.createNode(LITEGRAPH_WORKFLOW_STEP_TYPE);
      if (!node) return;
      const p = node.properties as {
        workflowNodeId: string;
        backendType: string;
        params: Record<string, unknown>;
      };
      p.workflowNodeId = id;
      p.backendType = typeKey;
      p.params = {};
      const wrap = wrapRef.current;
      applyCatalogToNode(node, catMap.get(typeKey), (t) =>
        nodeColorsRef.current(t, wrap),
      );
      if (graphPos) {
        node.pos[0] = graphPos[0] - node.size[0] * 0.5;
        node.pos[1] = graphPos[1] - node.size[1] * 0.5;
      } else {
        node.pos[0] = 120 + Math.random() * 80;
        node.pos[1] = 80 + Math.random() * 80;
      }
      rt.graph.add(node);
      rt.canvas.setDirty(true, true);
    },
    [catMap, readOnly],
  );

  const handleCanvasDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      if (
        ![...e.dataTransfer.types].includes(WORKFLOW_GRAPH_NODE_DRAG_MIME)
      ) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [readOnly],
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      const typeKey = e.dataTransfer.getData(WORKFLOW_GRAPH_NODE_DRAG_MIME);
      if (!typeKey || !catMapRef.current.has(typeKey)) {
        return;
      }
      e.preventDefault();
      const rt = runtimeRef.current;
      if (!rt) return;
      const [gx, gy] = clientToGraphCoords(rt.canvas, e.clientX, e.clientY);
      addNode(typeKey, [gx, gy]);
    },
    [readOnly, addNode],
  );

  const handlePaletteDragStart = useCallback(
    (typeKey: string, e: React.DragEvent) => {
      e.dataTransfer.setData(WORKFLOW_GRAPH_NODE_DRAG_MIME, typeKey);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedId || readOnly) return;
    const rt = runtimeRef.current;
    if (!rt) return;
    const n = findNodeByWorkflowId(rt.graph, selectedId);
    if (n) {
      rt.graph.remove(n);
      setSelectedId(null);
      setInspectorNode(null);
      rt.canvas.setDirty(true, true);
    }
  }, [readOnly, selectedId]);

  const zoomBy = useCallback((factor: number) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const c = rt.canvas;
    const rect = c.canvas.getBoundingClientRect();
    c.setZoom(c.ds.scale * factor, [
      rect.width * 0.5,
      rect.height * 0.5,
    ]);
  }, []);

  const zoomFit = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    fitWorkflowGraphView(rt.canvas, rt.graph, fitOptsRef.current);
  }, []);

  const defaultPalette =
    !readOnly && renderPalette === undefined ? (
      <aside
        data-slot="workflow-graph-palette"
        className="flex w-full shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3 text-sm shadow-sm sm:w-[11.75rem]"
      >
        <p className="border-b border-border/80 pb-2 text-xs font-semibold text-foreground">
          添加节点
        </p>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-0.5 sm:max-h-none sm:flex-col sm:gap-1">
          {nodeTypes.map((t) => (
            <Button
              key={t.type}
              type="button"
              variant="outline"
              size="sm"
              draggable
              title="点击添加，或拖到画布"
              className="h-8 cursor-grab justify-start border-border bg-card text-xs font-medium shadow-none hover:bg-accent active:cursor-grabbing"
              onClick={() => addNode(t.type)}
              onDragStart={(e) => handlePaletteDragStart(t.type, e)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </aside>
    ) : null;

  /* render props may close over imperative graph ref; safe here (no ref read during child render). */
  const paletteContent =
    readOnly
      ? null
      : renderPalette === undefined
        ? defaultPalette
        : renderPalette
          ? // eslint-disable-next-line react-hooks/refs -- addNode only touches graph on click
            renderPalette({ addNode })
          : null;

  const inspectorContent = renderInspector
    ? // eslint-disable-next-line react-hooks/refs -- handlers run on user action
      renderInspector({
        readOnly,
        selectedNode: inspectorNode,
        patchNodeParam,
        deleteSelectedNode,
      })
    : null;

  return (
    <div
      data-slot="workflow-graph-layout"
      className={cn(
        "flex min-h-[320px] flex-col gap-3",
        paletteContent != null && "sm:flex-row sm:gap-4",
        className,
      )}
    >
      {paletteContent}
      <div
        className={cn(
          "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40",
          readOnly && "workflow-graph-canvas-root--readonly",
          canvasAreaClassName,
        )}
      >
        <div ref={wrapRef} className="relative min-h-[280px] flex-1">
          <canvas
            ref={canvasRef}
            className="workflow-graph-canvas-el block h-full w-full min-h-[280px]"
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-1">
            <div
              data-slot="workflow-graph-zoom"
              className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 text-popover-foreground shadow-md backdrop-blur-md"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-b border-border"
                onClick={() => zoomBy(1.15)}
                aria-label="放大"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-b border-border"
                onClick={() => zoomBy(1 / 1.15)}
                aria-label="缩小"
              >
                <Minus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none"
                onClick={zoomFit}
                aria-label="适应画布"
              >
                <Maximize2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        {inspectorContent ? (
          <div className="workflow-graph-inspector shrink-0 border-t border-border bg-card p-3 text-card-foreground text-xs sm:absolute sm:right-3 sm:top-3 sm:max-w-[min(280px,calc(100%-1.5rem))] sm:rounded-lg sm:border sm:border-border sm:shadow-md sm:backdrop-blur-md">
            {inspectorContent}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export const WorkflowGraphCanvas = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(function WorkflowGraphCanvas(props, ref) {
  return <WorkflowGraphCanvasInner {...props} ref={ref} />;
});
