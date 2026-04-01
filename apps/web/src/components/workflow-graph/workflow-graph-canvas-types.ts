import type { ReactNode } from "react";

import type { WorkflowNodeAccent, WorkflowNodeTypeDefinition } from "./types";

export type WorkflowGraphCanvasHandle = {
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  getGraphJson: () => string;
  importGraphJson: (json: string) => void;
};

export type WorkflowGraphCanvasProps = {
  nodeTypes: WorkflowNodeTypeDefinition[];
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  initialGraphJson: string;
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
  /**
   * 画布区域内的额外覆盖层（例如缩放按钮、工具栏）。
   * 它会在内部 `WorkflowGraphZoomContext.Provider` 中渲染。
   */
  children?: ReactNode;
};
