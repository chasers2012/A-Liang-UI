"use client";

import "litegraph.js/css/litegraph.css";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  createContext,
  forwardRef,
  useContext,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defaultWorkflowNodeColors } from "./runtime";
import type { WorkflowGraphCanvasHandle, WorkflowGraphCanvasProps } from "./workflow-graph-canvas-types";
import { useWorkflowGraphCanvasRuntime } from "./use-workflow-graph-canvas-runtime";

import "./workflow-graph-canvas.css";

export type {
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps,
} from "./workflow-graph-canvas-types";

type WorkflowGraphZoomContextValue = {
  zoomBy: (factor: number) => void;
  zoomFit: () => void;
};

const WorkflowGraphZoomContext =
  createContext<WorkflowGraphZoomContextValue | null>(null);

function useWorkflowGraphZoom(): WorkflowGraphZoomContextValue {
  const ctx = useContext(WorkflowGraphZoomContext);
  if (!ctx) {
    throw new Error(
      "WorkflowGraphZoomToolbar must be used inside WorkflowGraphZoomContext provider",
    );
  }
  return ctx;
}

export function WorkflowGraphZoomToolbar() {
  const { zoomBy, zoomFit } = useWorkflowGraphZoom();
  return (
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
  );
}

export const WorkflowGraphCanvas = forwardRef<
  WorkflowGraphCanvasHandle,
  WorkflowGraphCanvasProps
>(
  function WorkflowGraphCanvas(
    { className, canvasAreaClassName, nodeColors = defaultWorkflowNodeColors, children, ...rest },
    ref,
  ) {
    const {
      wrapRef,
      canvasRef,
      handleCanvasDragOver,
      handleCanvasDrop,
      zoomBy,
      zoomFit,
    } = useWorkflowGraphCanvasRuntime(
      { ...(rest as WorkflowGraphCanvasProps), nodeColors },
      ref,
    );


    return (
      <div
        data-slot="workflow-graph-layout"
        className={cn(
          "flex min-h-[320px] flex-col gap-3",
          className,
        )}
      >
        <div
          className={cn(
            "workflow-graph-canvas-root relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted text-sm shadow-sm ring-1 ring-border/40",
            (rest.readOnly ?? false) && "workflow-graph-canvas-root--readonly",
            canvasAreaClassName,
          )}
        >
          <WorkflowGraphZoomContext.Provider value={{ zoomBy, zoomFit }}>
            <div ref={wrapRef} className="relative min-h-[280px] flex-1">
              <canvas
                ref={canvasRef}
                className="workflow-graph-canvas-el block h-full w-full min-h-[280px]"
                onDragOver={handleCanvasDragOver}
                onDrop={handleCanvasDrop}
              />
              {children}
            </div>
          </WorkflowGraphZoomContext.Provider>
        </div>
      </div>
    );
  });
