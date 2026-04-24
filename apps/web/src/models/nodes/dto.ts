import type { NodeTypeSocketPublic } from '../evaluation-profile/dto';

/** 与后端 ``workflow.NodeParamModel``（JSON）一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface NodeParamModel {
  key: string;
  label: string;
  type: string;
  /** 与 Socket / NodeParam 序列化字段一致，Markdown 说明 */
  description?: string | null;
  default?: unknown;
  minimum?: number | null;
  maximum?: number | null;
  /**
   * 后端 workflow.node_types.NodeParam.serialize() 扩展字段（用于前端渲染不同控件）。
   * - "select" | "number" | "input" | "textarea" | "toggle" | "date" | "datetime" | ...
   */
  render_type?: string | null;
  /** render_type=textarea 时后端 TextareaNodeParam.rows */
  rows?: number | null;
  /** 仅当 render_type=select 时可能存在 */
  options?: Array<string | number | { label: string | number; value: string | number }> | null;
  /** render_type=rjsf 时后端 RJSFNodeParam.json_schema */
  json_schema?: unknown;
  /** render_type=rjsf 时后端 RJSFNodeParam.ui_schema */
  ui_schema?: unknown;
}

/** 与后端 ``WorkflowNodeSummaryPublic``（``GET /nodes``）一致。 */
export interface NodeSummaryPublic {
  id: string;
  name: string;
  description: string;
  is_plugin: boolean;
  created_at: string;
  updated_at: string;
  category: string | null;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
}

export interface NodeDetailPublic extends NodeSummaryPublic {
  source: string;
}

/** 与后端 ``WorkflowDomainNodeVisibilityPublic``（``GET /nodes/node-visibility``）一致。 */
export interface WorkflowDomainNodeVisibilityPublic {
  domain: string;
  hidden_node_ids: string[];
}
