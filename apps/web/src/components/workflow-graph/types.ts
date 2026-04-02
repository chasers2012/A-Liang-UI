export type WorkflowSocketDefinition = {
  name: string;
  required: boolean;
  value_type: string;
  render_type?: string | null;
};

/**
 * 与后端 ``Socket.serialize()`` / ``NodeParam.serialize()`` 对齐的统一输入项：
 * 无 ``default`` 字段的为连线端口；含 ``default`` / ``render_type`` 等为节点内联字段。
 */
export type WorkflowNodeInputSpec = WorkflowSocketDefinition & {
  label?: string;
  default?: unknown;
  render_type?: string | null;
  options?: Array<string | number> | null;
  minimum?: number | null;
  maximum?: number | null;
};

/** 节点类型目录项：仅描述端口与展示名，不含业务扩展字段。 */
export type WorkflowNodeTypeDefinition = {
  type: string;
  label: string;
  /** 可选分类：由上层业务决定是否使用 */
  category?: string;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
};

export interface WorkflowGraphNode extends WorkflowNodeTypeDefinition {
  id: string;
  pos: [number, number];
  params?: Record<string, unknown>;
}

/** 选中节点在侧栏展示用的聚合数据。 */
export type WorkflowNodeDisplayData = {
  backendType: string;
  label: string;
  category?: string;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
  params: Record<string, unknown>;
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
