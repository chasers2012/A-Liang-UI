export type WorkflowSocketDefinition = {
  name: string;
  required: boolean;
  value_type: string;
  render_type?: string | null;
  label?: string;
  description?: string;
};

/**
 * 与后端 ``Socket.serialize()`` / ``NodeParam.serialize()`` 对齐的统一输入项：
 * 无 ``default`` 字段的为连线端口；含 ``default`` / ``render_type`` 等为节点内联字段。
 */
export type WorkflowNodeInputSpec = WorkflowSocketDefinition & {
  default?: unknown;
  render_type?: string | null;
  options?: Array<string | number> | null;
  minimum?: number | null;
  maximum?: number | null;
  /** TextareaNodeParam.rows */
  rows?: number | null;
};

/** 节点类型目录项：仅描述端口与展示名，不含业务扩展字段。 */
export type WorkflowNodeTypeDefinition = {
  id: string;
  label: string;
  description?: string;
  /** 可选分类：由上层业务决定是否使用 */
  category?: string;
  inputs: WorkflowNodeInputSpec[];
  outputs: WorkflowSocketDefinition[];
};

export interface WorkflowGraphNode extends WorkflowNodeTypeDefinition {
  type: string;
  pos: [number, number];
  params?: Record<string, unknown>;
}
