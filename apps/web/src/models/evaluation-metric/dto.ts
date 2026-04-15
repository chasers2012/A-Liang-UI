import type { NodeTypeSocketPublic } from '../evaluation-profile/dto';

/** 与后端 ``workflow.NodeParamModel``（JSON）一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface NodeParamModel {
  key: string;
  label: string;
  type: string;
  /** 与 Socket / NodeParam 序列化字段一致，Markdown 说明 */
  description?: string | null;
  default?: string | number | boolean | null;
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
}

/** 与后端 ``WorkflowNodeSummaryPublic``（``GET /nodes``）一致。 */
export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  created_at: string;
  updated_at: string;
  type: string;
  category: string | null;
  entry: string;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
