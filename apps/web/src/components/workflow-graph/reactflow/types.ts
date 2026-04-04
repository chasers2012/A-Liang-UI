import { Viewport } from "reactflow";
import { WorkflowGraphNode } from "..";

export type WorkflowGraphViewport = Viewport;

export type WorkflowGraphLink = {
  id?: string | null;
  from_node: string;
  from_socket: string;
  to_node: string;
  to_socket: string;
};

export type WorkflowGraphPersisted = {
  nodes: WorkflowGraphNode[];
  links: WorkflowGraphLink[];
  viewport?: WorkflowGraphViewport;
};
