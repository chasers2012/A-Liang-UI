/**
 * 从 `.workflow-graph-canvas-root` 上的 CSS 变量解析颜色，供 Canvas 绘制使用。
 * 视觉设计请在 `workflow-graph-canvas.css` 中通过变量与覆盖修改。
 */

import type { WorkflowNodeAccent } from "./types";

function readVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function canvasCssRoot(el: HTMLElement | null): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    el?.closest(".workflow-graph-canvas-root") ?? el ?? document.documentElement
  );
}

/** 节点标题条 / 背景 / 边框，对应 --lg-node-* */
export function readWorkflowNodeAccent(
  el: HTMLElement | null,
): WorkflowNodeAccent {
  const r = canvasCssRoot(el);
  if (!r) {
    return {
      color: "#fafafa",
      bgcolor: "#fafafa",
      boxcolor: "#e4e4e7",
    };
  }
  return {
    color: readVar(r, "--lg-node-color", readVar(r, "--card", "#fafafa")),
    bgcolor: readVar(r, "--lg-node-bg", readVar(r, "--card", "#fafafa")),
    boxcolor: readVar(r, "--lg-node-box", readVar(r, "--border", "#e4e4e7")),
  };
}

/** LiteGraph `default_link_color`，对应 --lg-link */
export function readWorkflowLinkColor(el: HTMLElement | null): string {
  const r = canvasCssRoot(el);
  if (!r) return "#18181b";
  return readVar(r, "--lg-link", readVar(r, "--foreground", "#18181b"));
}

/** 关联连线悬停高亮色，对应 --lg-link-highlight */
export function readWorkflowLinkHighlightColor(el: HTMLElement | null): string {
  const r = canvasCssRoot(el);
  if (!r) return "#2563eb";
  return readVar(
    r,
    "--lg-link-highlight",
    readVar(r, "--primary", readVar(r, "--foreground", "#2563eb")),
  );
}

/** 背景点阵颜色，对应 --lg-grid-dot */
export function readWorkflowGridDotColor(el: HTMLElement | null): string {
  const r = canvasCssRoot(el);
  if (!r) return "#d4d4d8";
  return readVar(r, "--lg-grid-dot", readVar(r, "--border", "#d4d4d8"));
}

/** 节点阴影（Canvas shadowColor），对应 --lg-node-shadow */
export function readWorkflowNodeShadowColor(el: HTMLElement | null): string {
  const r = canvasCssRoot(el);
  if (!r) return "rgba(0,0,0,0.14)";
  return readVar(r, "--lg-node-shadow", "rgba(0,0,0,0.14)");
}
