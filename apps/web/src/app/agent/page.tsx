"use client";

import { useState } from "react";

import { Page } from "@/components/page";
import { AgentListCard } from "./agent-list-card";
import { AgentWorkflowCanvasCard } from "./agent-workflow-canvas-card";

export default function AgentPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Page
      title="Agent"
      description="因子挖掘智能体：管理 Agent 工作流，可视化编辑节点与连线。"
    >
      <div className="flex gap-3 w-full flex-1 min-h-0">
        <AgentListCard selectedId={selectedId} onSelect={setSelectedId} />
        <AgentWorkflowCanvasCard workflowId={selectedId} />
      </div>
    </Page>
  );
}
