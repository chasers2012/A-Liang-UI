import type { LGraph, LGraphCanvas } from "litegraph.js";

import { canvasCssPixelSize } from "./hidpi";
import { graphNodes } from "./internal";

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
