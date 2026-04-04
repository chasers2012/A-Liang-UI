import type { WorkflowNodeTypeDefinition } from "@/components/workflow-graph";
import { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";

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
  graph: WorkflowGraphPersisted | null;
  created_at: string;
  updated_at: string;
};

export type AgentNodeTypePublic = WorkflowNodeTypeDefinition;
