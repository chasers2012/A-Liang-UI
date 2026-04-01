import type { WorkflowNodeTypeDefinition } from "@/components/workflow-graph";

/** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
export type AgentWorkflowGraphJson = string;

export type AgentWorkflowSummaryPublic = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type AgentWorkflowDetailPublic = {
  id: string;
  name: string;
  description: string;
  graph: AgentWorkflowGraphJson | null;
  created_at: string;
  updated_at: string;
};

export type AgentNodeTypePublic = WorkflowNodeTypeDefinition;
