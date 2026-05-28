import { WorkflowGraphNode } from '..';
import { WorkflowSocketDefinition } from '../types';

export type WorkflowGraphLink = {
  id?: string | null;
  from: { kind: 'node'; node_id: string; socket: string } | { kind: 'workflow_input'; socket: string };
  to: { kind: 'node'; node_id: string; socket: string } | { kind: 'workflow_output'; socket: string };
};

export type WorkflowGraphPersisted = {
  nodes: WorkflowGraphNode[];
  links: WorkflowGraphLink[];
  workflow_inputs: WorkflowSocketDefinition[];
  workflow_outputs: WorkflowSocketDefinition[];
  workflow_boundary_positions?: {
    input: [number, number];
    output: [number, number];
  };
};
