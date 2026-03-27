"use client";

import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  EvaluationWorkflowDto,
  NodeTypeDefinitionPublic,
} from "@/lib/quant-agent-api";

import {
  EvaluationWorkflowCanvas,
  type EvaluationWorkflowCanvasHandle,
} from "./evaluation-workflow-canvas";

export type ProfileEditorMainSection = "workflow" | "prepare";

export function ProfileEditorMainSectionSwitch(props: {
  mainSection: ProfileEditorMainSection;
  onMainSection: (v: ProfileEditorMainSection) => void;
}) {
  const { mainSection, onMainSection } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="shrink-0 text-muted-foreground">编辑</Label>
      <div className="flex gap-1">
        <Button
          type="button"
          variant={mainSection === "workflow" ? "default" : "outline"}
          size="sm"
          onClick={() => onMainSection("workflow")}
        >
          工作流
        </Button>
        <Button
          type="button"
          variant={mainSection === "prepare" ? "default" : "outline"}
          size="sm"
          onClick={() => onMainSection("prepare")}
        >
          准备参数
        </Button>
      </div>
    </div>
  );
}

type PrepareIds = {
  periods: string;
  quantiles: string;
  maxLoss: string;
  longShort: string;
};

export function ProfilePrepareFieldsGrid(props: {
  ids: PrepareIds;
  periodsCsv: string;
  onPeriodsCsv: (v: string) => void;
  quantiles: string;
  onQuantiles: (v: string) => void;
  quantilesPlaceholder?: string;
  maxLoss: string;
  onMaxLoss: (v: string) => void;
  longShort: boolean;
  onLongShort: (v: boolean) => void;
}) {
  const {
    ids,
    periodsCsv,
    onPeriodsCsv,
    quantiles,
    onQuantiles,
    quantilesPlaceholder,
    maxLoss,
    onMaxLoss,
    longShort,
    onLongShort,
  } = props;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={ids.periods}>持有期 periods（逗号分隔）</Label>
        <Input
          id={ids.periods}
          className="font-mono text-sm"
          value={periodsCsv}
          onChange={(e) => onPeriodsCsv(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.quantiles}>分位数 quantiles（空=用测试集）</Label>
        <Input
          id={ids.quantiles}
          className="font-mono text-sm"
          value={quantiles}
          onChange={(e) => onQuantiles(e.target.value)}
          placeholder={quantilesPlaceholder}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.maxLoss}>max_loss</Label>
        <Input
          id={ids.maxLoss}
          className="font-mono text-sm"
          value={maxLoss}
          onChange={(e) => onMaxLoss(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 pt-8">
        <Switch
          id={ids.longShort}
          checked={longShort}
          onCheckedChange={(v) => onLongShort(Boolean(v))}
        />
        <Label htmlFor={ids.longShort} className="font-normal">
          long_short
        </Label>
      </div>
    </div>
  );
}

/** Edit page: shorter labels (tab context). */
export function ProfilePrepareFieldsGridCompact(props: {
  ids: PrepareIds;
  periodsCsv: string;
  onPeriodsCsv: (v: string) => void;
  quantiles: string;
  onQuantiles: (v: string) => void;
  maxLoss: string;
  onMaxLoss: (v: string) => void;
  longShort: boolean;
  onLongShort: (v: boolean) => void;
}) {
  const {
    ids,
    periodsCsv,
    onPeriodsCsv,
    quantiles,
    onQuantiles,
    maxLoss,
    onMaxLoss,
    longShort,
    onLongShort,
  } = props;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={ids.periods}>持有期 periods</Label>
        <Input
          id={ids.periods}
          className="font-mono text-sm"
          value={periodsCsv}
          onChange={(e) => onPeriodsCsv(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.quantiles}>quantiles</Label>
        <Input
          id={ids.quantiles}
          className="font-mono text-sm"
          value={quantiles}
          onChange={(e) => onQuantiles(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.maxLoss}>max_loss</Label>
        <Input
          id={ids.maxLoss}
          className="font-mono text-sm"
          value={maxLoss}
          onChange={(e) => onMaxLoss(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 pt-8">
        <Switch
          id={ids.longShort}
          checked={longShort}
          onCheckedChange={(v) => onLongShort(Boolean(v))}
        />
        <Label htmlFor={ids.longShort} className="font-normal">
          long_short
        </Label>
      </div>
    </div>
  );
}

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
