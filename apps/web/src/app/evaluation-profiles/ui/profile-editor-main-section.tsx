"use client";

import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  EvaluationWorkflowDto,
  NodeTypeDefinitionPublic,
} from "@/lib/quant-agent-api";

import {
  EvaluationWorkflowCanvas,
  type EvaluationWorkflowCanvasHandle,
} from "./evaluation-workflow-canvas";

export function ProfileWorkflowEditorBlock(props: {
  workflowJson: string;
  onWorkflowJson: (v: string) => void;
  workflowJsonFieldId: string;
  workflowEditMode: "canvas" | "json";
  onWorkflowMode: (next: "canvas" | "json") => void;
  wfMetaLoading?: boolean;
  canvasKey: number;
  canvasRef: RefObject<EvaluationWorkflowCanvasHandle | null>;
  catalog: NodeTypeDefinitionPublic[];
  initialWorkflow: EvaluationWorkflowDto;
}) {
  const {
    workflowJson,
    onWorkflowJson,
    workflowJsonFieldId,
    workflowEditMode,
    onWorkflowMode,
    wfMetaLoading = false,
    canvasKey,
    canvasRef,
    catalog,
    initialWorkflow,
  } = props;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="shrink-0">工作流</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={workflowEditMode === "canvas" ? "default" : "outline"}
            size="sm"
            disabled={wfMetaLoading}
            onClick={() => onWorkflowMode("canvas")}
          >
            画布
          </Button>
          <Button
            type="button"
            variant={workflowEditMode === "json" ? "default" : "outline"}
            size="sm"
            onClick={() => onWorkflowMode("json")}
          >
            JSON
          </Button>
        </div>
      </div>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">
          加载节点类型与指标列表…
        </p>
      ) : workflowEditMode === "canvas" ? (
        <EvaluationWorkflowCanvas
          key={canvasKey}
          ref={canvasRef}
          catalog={catalog}
          initialWorkflow={initialWorkflow}
        />
      ) : (
        <>
          <Label htmlFor={workflowJsonFieldId} className="sr-only">
            工作流 JSON
          </Label>
          <Textarea
            id={workflowJsonFieldId}
            className="min-h-48 font-mono text-xs"
            value={workflowJson}
            onChange={(e) => onWorkflowJson(e.target.value)}
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}
