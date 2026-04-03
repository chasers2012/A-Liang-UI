"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listEvaluationNodeTypes,
  type EvaluationProfilePublic,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/lib/quant-agent-api";

import { WorkflowGraphCanvas, type WorkflowNodeTypeDefinition } from "@/components/workflow-graph";

function toWorkflowNodeTypes(
  catalog: EvaluationNodeTypeCatalogItemPublic[],
): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    type: c.type,
    label: c.label,
    category: c.category ?? undefined,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}

export function ProfileDetailWorkflowCard(props: {
  profile: EvaluationProfilePublic;
  profileId: string;
}) {
  const { profile, profileId } = props;
  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>([]);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  useEffect(() => {
    void listEvaluationNodeTypes()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>工作流</CardTitle>
      </CardHeader>
      <CardContent>
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载画布…</p>
        ) : (
          <WorkflowGraphCanvas
            key={profileId}
            nodeTypes={nodeTypes}
            initialGraph={profile.workflow}
            readOnly
            className="h-[min(560px,72vh)] min-h-[320px]"
          />
        )}
      </CardContent>
    </Card>
  );
}
