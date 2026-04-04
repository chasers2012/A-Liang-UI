"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import json
import traceback
from typing import Any

from evaluation_workflow_nodes.collect_result import CollectResult
from workflow import WorkflowExecutor, WorkflowGraph

from app.evaluation.profile.profile_schemas import EvaluationProfileRecord
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import utc_now_iso

from .schemas import FactorEvaluationRecord


def _extract_collected_result(
    workflow: str,
    node_results: dict[str, dict[str, Any]],
    collect_node_type: type,
) -> Any | None:
    """从 workflow JSON 中找到所有指定类型的收集节点，并从执行结果中提取其输出。

    - workflow: 序列化后的工作流 JSON 字符串。
    - node_results: WorkflowExecutor.execute 返回的节点执行结果映射。
    - collect_node_type: 需要提取结果的节点类型（例如 CollectResult）。


    如果有多个，则按节点在 workflow 中出现的顺序返回结果列表。
    """
    try:
        payload = json.loads(workflow)
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    graph = WorkflowGraph.parse(payload)
    if not graph.nodes:
        return None

    collect_node_ids: list[str] = [
        node.id for node in graph.nodes if isinstance(node, collect_node_type)
    ]

    if not collect_node_ids:
        return None

    collected_values: list[Any] = []
    for nid in collect_node_ids:
        if nid in node_results:
            collected_values.append(node_results[nid])

    return collected_values


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
) -> FactorEvaluationRecord:

    factor = FactorItemsRegistry.get_factor(factor_id)

    exec_ctx: dict[str, Any] = {"factor": factor}

    executor = WorkflowExecutor()

    try:
        node_results = executor.execute(profile.workflow, context=exec_ctx)
        collected_result = _extract_collected_result(
            profile.workflow, node_results, collect_node_type=CollectResult
        )
        final_result = collected_result
    except ValueError as e:
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
        )

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(),
        evaluation_profile_id=profile.id,
        results=final_result,
    )
