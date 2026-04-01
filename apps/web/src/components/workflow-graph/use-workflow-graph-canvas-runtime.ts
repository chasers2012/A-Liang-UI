import { LiteGraph, LGraph, LGraphCanvas } from "litegraph.js";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";

import { drawDotGrid } from "./draw-dot-grid";
import { catalogToMap } from "./graph-model";
import {
  applyHiDpiToLGraphCanvas,
  attachWorkflowLiteGraphCanvasHooks,
  clientToGraphCoords,
  configureLiteGraphGlobals,
  fitWorkflowGraphView,
  setCanvasViewport,
} from "./litegraph";
import {
  applyCatalogToNode,
  applyWorkflowLiteGraphPaintFromCss,
  cleanupExtraInputSlots,
  defaultWorkflowNodeColors,
  EMPTY_LITEGRAPH_GRAPH_JSON,
  getViewportFromLiteGraphSerializedJson,
  graphToSerializedJson,
  LITEGRAPH_WORKFLOW_STEP_TYPE,
  loadWorkflowJsonIntoGraph,
  reapplyAllWorkflowNodeColors,
} from "./runtime";
import { readWorkflowGridDotColor } from "./workflow-graph-theme";
import {
  DEFAULT_FIT,
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
} from "./workflow-graph-canvas-constants";
import type {
  LGraphCanvasChrome,
  LGraphWithConnectionHook,
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "./workflow-graph-canvas-types";
import { shouldBlockProcessKeyInWorkflowReadOnly } from "./workflow-readonly-keys";

type GraphRuntime = {
  graph: LGraph;
  canvas: LGraphCanvas;
};

export function useWorkflowGraphCanvasRuntime(
  props: Pick<
    WorkflowGraphCanvasProps,
    | "nodeTypes"
    | "initialGraphJson"
    | "readOnly"
    | "dotGridGap"
    | "fitViewOptions"
    | "nodeColors"
  >,
  ref: React.ForwardedRef<WorkflowGraphCanvasHandle>,
): {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handleCanvasDragOver: (e: React.DragEvent<HTMLCanvasElement>) => void;
  handleCanvasDrop: (e: React.DragEvent<HTMLCanvasElement>) => void;
  zoomBy: (factor: number) => void;
  zoomFit: () => void;
} {
  const {
    nodeTypes,
    initialGraphJson,
    readOnly = false,
    dotGridGap = 22,
    fitViewOptions = DEFAULT_FIT,
    nodeColors = defaultWorkflowNodeColors,
  } = props;

  const catMap = useMemo(() => catalogToMap(nodeTypes), [nodeTypes]);
  const catMapRef = useRef(catMap);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GraphRuntime | null>(null);
  const readOnlyRef = useRef(readOnly);
  const initialGraphJsonRef = useRef(initialGraphJson);
  const nodeColorsRef = useRef(nodeColors ?? defaultWorkflowNodeColors);
  const fitOptsRef = useRef(fitViewOptions);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    catMapRef.current = catMap;
  }, [catMap]);

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
    initialGraphJsonRef.current = initialGraphJson;
  }, [initialGraphJson]);

  useEffect(() => {
    configureLiteGraphGlobals();

    const canvasEl = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvasEl || !wrap) return;

    const graph = new LGraph();
    graph.config = {
      ...(graph.config ?? {}),
      align_to_grid: !readOnlyRef.current,
      interactionReadOnly: readOnlyRef.current,
    };

    const graphCanvas = new LGraphCanvas(canvasEl, graph, { autoresize: true });
    attachWorkflowLiteGraphCanvasHooks(graphCanvas);

    applyHiDpiToLGraphCanvas(graphCanvas);

    graphCanvas.background_image = "";
    graphCanvas.clear_background = true;
    (graphCanvas as unknown as { clear_background_color: string }).clear_background_color =
      "transparent";
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
      const ro = Boolean(
        (graph.config as { interactionReadOnly?: boolean })?.interactionReadOnly,
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

    (graph as LGraphWithConnectionHook).onNodeConnectionChange = (
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

    loadWorkflowJsonIntoGraph(
      graph,
      initialGraphJsonRef.current,
      catMap,
      (t) => nodeColorsRef.current(t, wrap),
      {
        interactionReadOnly: readOnlyRef.current,
        align_to_grid: !readOnlyRef.current,
      },
    );

    requestAnimationFrame(() => {
      graphCanvas.resize();
      applyWorkflowLiteGraphPaintFromCss(wrap, graphCanvas);
      const vp = getViewportFromLiteGraphSerializedJson(
        initialGraphJsonRef.current,
      );
      if (vp) {
        setCanvasViewport(graphCanvas, vp);
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
  }, [catMap, dotGridGap]);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    rt.graph.config = {
      ...(rt.graph.config ?? {}),
      align_to_grid: !readOnly,
      interactionReadOnly: readOnly,
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
    reapplyAllWorkflowNodeColors(rt.graph, wrap, (t, el) =>
      nodeColorsRef.current(t, el),
    );
    applyWorkflowLiteGraphPaintFromCss(wrap, rt.canvas);
    rt.canvas.setDirty(true, true);
  }, []);

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

  const getGraphJson = useCallback((): string => {
    const rt = runtimeRef.current;
    if (!rt) return EMPTY_LITEGRAPH_GRAPH_JSON;
    return graphToSerializedJson(rt.graph, rt.canvas);
  }, []);

  const importGraphJson = useCallback(
    (json: string) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      const wrap = wrapRef.current;
      loadWorkflowJsonIntoGraph(rt.graph, json, catMap, (t) =>
        nodeColorsRef.current(t, wrap),
        {
          interactionReadOnly: readOnlyRef.current,
          align_to_grid: !readOnlyRef.current,
        },
      );
      if (wrap) {
        applyWorkflowLiteGraphPaintFromCss(wrap, rt.canvas);
      }
      requestAnimationFrame(() => {
        rt.canvas.resize();
        const vp = getViewportFromLiteGraphSerializedJson(json);
        if (vp) {
          setCanvasViewport(rt.canvas, vp);
        } else {
          fitWorkflowGraphView(rt.canvas, rt.graph, fitOptsRef.current);
        }
        rt.canvas.setDirty(true, true);
      });
    },
    [catMap],
  );

  useImperativeHandle(ref, () => ({ getGraphJson, importGraphJson }), [
    getGraphJson,
    importGraphJson,
  ]);

  const addNode = useCallback(
    (typeKey: string, graphPos?: readonly [number, number]) => {
      const rt = runtimeRef.current;
      if (!rt || readOnly) return;
      const id = crypto.randomUUID();
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
      if (![...e.dataTransfer.types].includes(WORKFLOW_GRAPH_NODE_DRAG_MIME)) {
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

  const zoomBy = useCallback((factor: number) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const c = rt.canvas;
    const rect = c.canvas.getBoundingClientRect();
    c.setZoom(c.ds.scale * factor, [rect.width * 0.5, rect.height * 0.5]);
  }, []);

  const zoomFit = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    fitWorkflowGraphView(rt.canvas, rt.graph, fitOptsRef.current);
  }, []);

  return {
    wrapRef,
    canvasRef,
    handleCanvasDragOver,
    handleCanvasDrop,
    zoomBy,
    zoomFit,
  };
}

