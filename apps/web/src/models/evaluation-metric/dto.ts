/** 与后端 ``workflow.NodeParamModel``（JSON）一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface NodeParamModel {
  key: string;
  label: string;
  type: string;
  default?: string | number | boolean | null;
  minimum?: number | null;
  maximum?: number | null;
  /**
   * 后端 workflow.node_types.NodeParam.serialize() 扩展字段（用于前端渲染不同控件）。
   * - "select" | "number" | "input" | "toggle" | "date" | "datetime" | ...
   */
  render_type?: string | null;
  /** 仅当 render_type=select 时可能存在 */
  options?: Array<
    string | number | { label: string | number; value: string | number }
  > | null;
}

export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  /** 评价指标节点 id（与后端路由参数 `metric_id` 一致）。 */
  created_at: string;
  updated_at: string;
  workflow_parameters?: NodeParamModel[];
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
