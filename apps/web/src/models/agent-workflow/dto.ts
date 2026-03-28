import type { WorkflowGraphState, WorkflowNodeTypeDefinition } from "@/components/workflow-graph";

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
  graph: WorkflowGraphState;
  created_at: string;
  updated_at: string;
};

export type AgentNodeTypePublic = WorkflowNodeTypeDefinition;
