import type {
  EvaluationWorkflowGraphJson,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

import {
  parseWorkflowGraphNodesFromSerializedJson,
} from "@/components/workflow-graph";

export const DEFAULT_WORKFLOW_JSON = `{"nodes":[],"links":[],"viewport":null}`;

export const EMPTY_EVALUATION_WORKFLOW: EvaluationWorkflowGraphJson =
  DEFAULT_WORKFLOW_JSON;

/** 校验工作流图 JSON（schema: `{nodes,links,viewport}`），返回规范化字符串。 */
export function parseEvaluationWorkflowJson(
  s: string,
): EvaluationWorkflowGraphJson {
  const trimmed = s.trim();
  if (!trimmed) {
    return EMPTY_EVALUATION_WORKFLOW;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error("工作流图 JSON 无法解析");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("工作流图须为 JSON 对象");
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.nodes)) throw new Error("工作流图须包含 nodes 数组");
  if (!Array.isArray(o.links)) throw new Error("工作流图须包含 links 数组");
  if ("viewport" in o && o.viewport != null && typeof o.viewport !== "object") {
    throw new Error("viewport 须为对象或 null");
  }
  return JSON.stringify(o);
}

/** 从工作流图 JSON 中提取业务节点摘要。 */
export function parseWorkflowNodesFromGraphJson(
  json: string,
): WorkflowNodeDto[] {
  return parseWorkflowGraphNodesFromSerializedJson(json) as WorkflowNodeDto[];
}
