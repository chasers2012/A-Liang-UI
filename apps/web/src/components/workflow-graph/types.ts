/** 与具体业务（评价方案等）解耦的 LiteGraph 工作流图数据模型。 */

import { NodeParamModel } from "@/models";

export type WorkflowSocketDefinition = {
  name: string;
  required: boolean;
  value_type: string;
};

/** 节点类型目录项：仅描述端口与展示名，不含业务扩展字段。 */
export type WorkflowNodeTypeDefinition = {
  type: string;
  label: string;
  /** 可选分类：由上层业务决定是否使用 */
  category?: string;
  inputs: WorkflowSocketDefinition[];
  outputs: WorkflowSocketDefinition[];
};

export type WorkflowGraphNode = {
  id: string;
  type: string;
  pos: [number, number];
  params?: Record<string, unknown>;
};

export type WorkflowGraphLink = {
  id?: string;
  from_node: string;
  from_socket: string;
  to_node: string;
  to_socket: string;
};

export type WorkflowGraphViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowGraphState = {
  nodes: WorkflowGraphNode[];
  links: WorkflowGraphLink[];
  viewport: WorkflowGraphViewport | null;
};

/** 选中节点在侧栏展示用的聚合数据。 */
export type WorkflowNodeDisplayData = {
  backendType: string;
  label: string;
  category?: string;
  inputs: WorkflowSocketDefinition[];
  outputs: WorkflowSocketDefinition[];
  params: Record<string, NodeParamModel>;
};

export type WorkflowGraphSelectedNode = {
  id: string;
  position: { x: number; y: number };
  data: WorkflowNodeDisplayData;
};

export type WorkflowNodeAccent = {
  color: string;
  bgcolor: string;
  boxcolor: string;
};
