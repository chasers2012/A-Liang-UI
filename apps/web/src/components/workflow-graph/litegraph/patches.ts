import { LiteGraph, LGraphCanvas } from "litegraph.js";

/**
 * One-time global LiteGraph tweaks + highlight color patch (no per-canvas
 * menu / mouse overrides — those live in `attachWorkflowLiteGraphCanvasHooks`).
 */
export function configureLiteGraphGlobals(): void {
  LiteGraph.CANVAS_GRID_SIZE = 12;
  LiteGraph.NODE_SLOT_HEIGHT = 18;
  LiteGraph.NODE_TITLE_HEIGHT = 26;
  LiteGraph.NODE_TEXT_SIZE = 13;
  LiteGraph.NODE_SUBTEXT_SIZE = 11;
  patchLGraphRenderLinkHighlightColor();
}

type LiteGraphWithHighlight = typeof LiteGraph & {
  WORKFLOW_LINK_HIGHLIGHT_COLOR?: string;
};

let renderLinkHighlightPatched = false;

/**
 * LiteGraph uses hardcoded #FFF for highlighted links; patch to use theme color from
 * `LiteGraph.WORKFLOW_LINK_HIGHLIGHT_COLOR` (set by app CSS bridge).
 */
function patchLGraphRenderLinkHighlightColor(): void {
  if (renderLinkHighlightPatched) return;
  renderLinkHighlightPatched = true;

  const original = LGraphCanvas.prototype.renderLink as unknown as (
    this: LGraphCanvas,
    ...args: unknown[]
  ) => void;
  if (typeof original !== "function") return;

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
