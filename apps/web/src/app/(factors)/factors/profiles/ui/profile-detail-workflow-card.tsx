"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  listEvaluationNodeTypes,
  type EvaluationProfilePublic,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/lib/quant-agent-api";

import { EvaluationWorkflowCanvas } from "./evaluation-workflow-canvas";
import {
  EMPTY_EVALUATION_WORKFLOW,
  parseEvaluationWorkflowJson,
} from "./profile-form-shared";

function prettyWorkflowForDisplay(workflow: string): string {
  try {
    return JSON.stringify(JSON.parse(workflow), null, 2);
  } catch {
    return workflow;
  }
}

export function ProfileDetailWorkflowCard(props: {
  profile: EvaluationProfilePublic;
  profileId: string;
}) {
  const { profile, profileId } = props;
  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>([]);
  const [workflowView, setWorkflowView] = useState<"canvas" | "json">(
    "canvas",
  );

  useEffect(() => {
    void listEvaluationNodeTypes()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const initialWorkflow = useMemo(() => {
    try {
      return parseEvaluationWorkflowJson(profile.workflow);
    } catch {
      return EMPTY_EVALUATION_WORKFLOW;
    }
  }, [profile.workflow]);

  const workflowJsonDisplay = useMemo(
    () => prettyWorkflowForDisplay(profile.workflow),
    [profile.workflow],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>工作流</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="shrink-0 text-muted-foreground">显示</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={workflowView === "canvas" ? "default" : "outline"}
              size="sm"
              onClick={() => setWorkflowView("canvas")}
            >
              画布
            </Button>
            <Button
              type="button"
              variant={workflowView === "json" ? "default" : "outline"}
              size="sm"
              onClick={() => setWorkflowView("json")}
            >
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {workflowView === "canvas" ? (
          catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">加载画布…</p>
          ) : (
            <EvaluationWorkflowCanvas
              key={profileId}
              catalog={catalog}
              initialWorkflow={initialWorkflow}
              readOnly
            />
          )
        ) : (
          <pre className="max-h-[min(60vh,32rem)] overflow-auto rounded-xl border border-border/80 bg-muted/30 p-3 font-mono text-xs leading-relaxed shadow-sm">
            {workflowJsonDisplay}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
