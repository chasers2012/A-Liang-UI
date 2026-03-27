"use client";

import { LiteGraph, LGraph, LGraphCanvas } from "litegraph.js";
import "litegraph.js/css/litegraph.css";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { catalogToMap } from "./graph-model";
import type {
  WorkflowGraphSelectedNode,
  WorkflowGraphState,
  WorkflowNodeAccent,
  WorkflowNodeTypeDefinition,
} from "./types";
import {
  applyCatalogToNode,
  applyHiDpiToLGraphCanvas,
  configureLiteGraphGlobals,
  defaultWorkflowNodeColors,
  findNodeByWorkflowId,
  fitWorkflowGraphView,
  graphToWorkflowState,
  liteGraphNodeToSelectedNode,
  loadWorkflowStateIntoGraph,
  LITEGRAPH_WORKFLOW_STEP_TYPE,
  registerWorkflowStepNodeType,
  setCanvasViewport,
} from "./workflow-graph-litegraph";

import "./workflow-graph-canvas.css";

const DEFAULT_FIT = { padding: 0.14, maxZoom: 1.15, minZoom: 0.08 };

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
  /** 节点配色；默认中性灰蓝。 */
  nodeColors?: (typeKey: string) => WorkflowNodeAccent;
  /** 自定义左侧「添加节点」区；不传且非只读时用 `nodeTypes` 生成按钮列表。 */
  renderPalette?: (ctx: { addNode: (typeKey: string) => void }) => ReactNode;
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

function readBorderColor(el: HTMLElement | null): string {
  if (!el) return "#94a3b8";
  const v = getComputedStyle(el).getPropertyValue("--border").trim();
  return v || "#94a3b8";
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GraphRuntime | null>(null);
  const readOnlyRef = useRef(readOnly);
  const initialGraphRef = useRef(initialGraph);
  const nodeColorsRef = useRef(nodeColors);
  const fitOptsRef = useRef(fitViewOptions);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    nodeColorsRef.current = nodeColors;
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
    graphCanvas.multi_select = false;
    graphCanvas.show_info = false;
    graphCanvas.render_canvas_border = false;

    graphCanvas.onDrawBackground = (ctx, visible) => {
      drawDotGrid(ctx, visible, dotGridGap, readBorderColor(wrap));
    };

    const baseProcessKey = graphCanvas.processKey.bind(graphCanvas);
    graphCanvas.processKey = function (e: KeyboardEvent) {
      const g = graph;
      const ro = Boolean(
        (g.config as { workflowReadOnly?: boolean })?.workflowReadOnly,
      );
      if (
        ro &&
        e.type === "keydown" &&
        (e.keyCode === 46 || e.keyCode === 8)
      ) {
        const t = e.target as HTMLElement;
        if (t?.localName !== "input" && t?.localName !== "textarea") {
          e.preventDefault();
          return false;
        }
      }
      return baseProcessKey(e);
    };

    graphCanvas.onSelectionChange = () => {
      syncSelectionFromCanvas();
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
      (t) => nodeColorsRef.current(t),
    );
    requestAnimationFrame(() => {
      graphCanvas.resize();
      graphCanvas.default_link_color = readBorderColor(wrap);
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
      align_to_grid: !readOnly,
      workflowReadOnly: readOnly,
    };
    rt.canvas.allow_dragnodes = !readOnly;
    rt.canvas.allow_reconnect_links = !readOnly;
  }, [readOnly]);

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
      loadWorkflowStateIntoGraph(rt.graph, g, catMap, (t) =>
        nodeColorsRef.current(t),
      );
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
    (typeKey: string) => {
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
      node.pos[0] = 120 + Math.random() * 80;
      node.pos[1] = 80 + Math.random() * 80;
      applyCatalogToNode(node, catMap.get(typeKey), nodeColorsRef.current);
      rt.graph.add(node);
      rt.canvas.setDirty(true, true);
    },
    [catMap, readOnly],
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
      <aside className="flex w-full shrink-0 flex-col gap-2 rounded-xl border border-border/80 bg-muted/10 p-3 text-sm shadow-sm sm:w-[11.5rem]">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          添加节点
        </p>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-0.5 sm:max-h-none sm:flex-col sm:gap-1">
          {nodeTypes.map((t) => (
            <Button
              key={t.type}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 justify-start border-border/80 bg-background text-xs font-medium shadow-none hover:bg-accent/60"
              onClick={() => addNode(t.type)}
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
      className={cn(
        "flex min-h-[320px] flex-col gap-3",
        paletteContent != null && "sm:flex-row",
        className,
      )}
    >
      {paletteContent}
      <div
        className={cn(
          "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-muted/30 text-sm shadow-sm",
          readOnly && "workflow-graph-canvas-root--readonly",
          canvasAreaClassName,
        )}
      >
        <div ref={wrapRef} className="relative min-h-[280px] flex-1">
          <canvas
            ref={canvasRef}
            className="workflow-graph-canvas-el block h-full w-full min-h-[280px]"
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-1">
            <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-border/80 bg-card shadow-sm backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-b border-border/60"
                onClick={() => zoomBy(1.15)}
                aria-label="放大"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-b border-border/60"
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
          <div className="workflow-graph-inspector shrink-0 border-t border-border/80 bg-card p-3 text-xs sm:absolute sm:right-3 sm:top-3 sm:max-w-[min(280px,calc(100%-1.5rem))] sm:rounded-lg sm:border sm:border-border/80 sm:shadow-sm sm:backdrop-blur-sm">
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
