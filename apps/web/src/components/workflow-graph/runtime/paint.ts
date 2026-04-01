import { LiteGraph, type LGraphCanvas } from "litegraph.js";

import {
  readWorkflowLinkColor,
  readWorkflowLinkHighlightColor,
  readWorkflowNodeShadowColor,
} from "../workflow-graph-theme";

function readCssVar(root: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

type LiteGraphWithHighlight = typeof LiteGraph & {
  WORKFLOW_LINK_HIGHLIGHT_COLOR?: string;
};

type LiteGraphPaintGlobals = typeof LiteGraph & {
  NODE_SELECTED_TITLE_COLOR: string;
  NODE_BOX_OUTLINE_COLOR: string;
};

const LG = LiteGraph as LiteGraphPaintGlobals;

/**
 * Sync CSS variables from `.workflow-graph-canvas-root` into LiteGraph static colors
 * and the given `LGraphCanvas` instance.
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
