import type { WorkflowNodeTypeDefinition } from "@/components/workflow-graph";

/** LiteGraph `graph.serialize()` JSON 字符串。 */
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
