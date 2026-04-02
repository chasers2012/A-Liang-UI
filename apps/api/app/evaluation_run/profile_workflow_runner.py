"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import json
import traceback
from typing import Any

from workflow import WorkflowExecutor, WorkflowGraph, topological_order

from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import utc_now_iso

from .schemas import FactorEvaluationRecord


def _extract_collected_result(workflow: str, node_results: dict[str, dict[str, Any]]) -> Any | None:
    payload = json.loads(workflow)
    if not isinstance(payload, dict):
        return None

    graph = WorkflowGraph.parse(payload)
    order = topological_order(graph.nodes, graph.links)
    by_id = {n.id: n for n in graph.nodes}

    collector_ids: list[str] = []
    for nid in order:
        node = by_id[nid]
        if node.__class__.__name__ == "CollectResult":
            collector_ids.append(nid)

    if not collector_ids:
        return None

    collector_id = collector_ids[-1]
    collected: dict[str, Any] = {}
    for link in graph.links:
        if link.to_node != collector_id:
            continue
        from_bucket = node_results.get(link.from_node)
        if from_bucket is None:
            raise KeyError(link.from_node)
        if link.from_socket not in from_bucket:
            raise KeyError(link.from_socket)
        if link.to_socket in collected:
            raise ValueError(f"结果收集节点输入键重复: {link.to_socket}")
        collected[link.to_socket] = from_bucket[link.from_socket]
    return collected


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
) -> FactorEvaluationRecord:

    factor = FactorItemsRegistry.get_factor(factor_id)

    exec_ctx: dict[str, Any] = {"factor": factor}

    executor = WorkflowExecutor()

    try:
        node_results = executor.execute(profile.workflow, context=exec_ctx)
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

    collected_result = _extract_collected_result(profile.workflow, node_results)
    final_result = collected_result if collected_result is not None else node_results

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(),
        evaluation_profile_id=profile.id,
        result=final_result,
    )
