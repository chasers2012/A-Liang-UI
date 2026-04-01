import type {
  EvaluationWorkflowGraphJson,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

import {
  parseAndValidateLiteGraphGraphJson,
  parseWorkflowGraphNodesFromSerializedJson,
} from "@/components/workflow-graph";

export const DEFAULT_WORKFLOW_JSON = `{"nodes":[],"links":[]}`;

export const EMPTY_EVALUATION_WORKFLOW: EvaluationWorkflowGraphJson =
  DEFAULT_WORKFLOW_JSON;

/** 校验工作流图为可 `LGraph.configure` 的 JSON，返回规范化字符串。 */
export function parseEvaluationWorkflowJson(
  s: string,
): EvaluationWorkflowGraphJson {
  const trimmed = s.trim();
  if (!trimmed) {
    return EMPTY_EVALUATION_WORKFLOW;
  }
  const o = parseAndValidateLiteGraphGraphJson(trimmed);
  if (!Array.isArray(o.nodes)) {
    throw new Error("工作流图须包含 nodes 数组");
  }
  if (!Array.isArray(o.links)) {
    throw new Error("工作流图须包含 links 数组");
  }
  return JSON.stringify(o);
}

/** 从 LiteGraph 序列化 JSON 中提取业务节点摘要。 */
export function parseWorkflowNodesFromLiteGraphJson(
  json: string,
): WorkflowNodeDto[] {
  return parseWorkflowGraphNodesFromSerializedJson(json) as WorkflowNodeDto[];
}
