export type WorkflowGraphViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowGraphLink = {
  id?: string | null;
  from_node: string;
  from_socket: string;
  to_node: string;
  to_socket: string;
};

export type WorkflowGraphPersisted = {
  nodes: Array<{
    id: string;
    type: string;
    pos: [number, number] | number[];
    params?: Record<string, unknown>;
  }>;
  links: WorkflowGraphLink[];
  viewport?: WorkflowGraphViewport | null;
};

