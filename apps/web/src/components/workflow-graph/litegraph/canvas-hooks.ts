import type { LGraphCanvas, LGraphNode, LLink } from "litegraph.js";

type GraphConfigRo = { interactionReadOnly?: boolean };

function readInteractionReadOnly(canvas: LGraphCanvas): boolean {
  return Boolean(
    (canvas.graph?.config as GraphConfigRo | undefined)?.interactionReadOnly,
  );
}

/**
 * Per-canvas overrides (no prototype patching). LiteGraph does not expose flags
 * to disable context menus while keeping node selection; we no-op the hooks
 * this canvas uses.
 */
export function attachWorkflowLiteGraphCanvasHooks(canvas: LGraphCanvas): void {
  canvas.processContextMenu = function (
    this: LGraphCanvas,
    _node: LGraphNode | null,
    _event: Event,
  ): void {
    void this;
    void _node;
    void _event;
  };

  canvas.showLinkMenu = function (
    this: LGraphCanvas,
    _link: LLink,
    _e: unknown,
  ): false {
    void this;
    void _link;
    void _e;
    return false;
  };

  const protoDown = LGraphCanvas.prototype.processMouseDown;
  canvas.processMouseDown = function (this: LGraphCanvas, e: MouseEvent) {
    const ret = protoDown.call(this, e);
    const ro = readInteractionReadOnly(this);
    const me = e as MouseEvent & { which?: number };
    if (ro && this.dragging_rectangle && me.ctrlKey && me.which === 1) {
      this.dragging_rectangle = null;
    }
    return ret;
  };
}
