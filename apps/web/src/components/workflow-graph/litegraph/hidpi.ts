import {
  LGraphCanvas,
  type DragAndScale,
  type LGraphNode,
  type Vector4,
} from "litegraph.js";

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
