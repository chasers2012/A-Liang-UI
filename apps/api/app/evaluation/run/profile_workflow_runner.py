"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from typing import Any

from evaluation_workflow_nodes.collect_result import CollectResult
from workflow import WorkflowExecutor
from workflow.parser import Parser

from app.evaluation.profile.schemas import EvaluationProfileRecord
from app.factors.controller import get_factor

from .schemas import EvaluationRunRecord


def _to_jsonable_pandas(value: Any) -> Any | None:
    try:
        import pandas as pd

        if isinstance(value, pd.DataFrame):
            frame = value.copy()
            frame.columns = [str(c) for c in frame.columns]
            if isinstance(frame.index, pd.MultiIndex):
                frame = frame.reset_index()
            else:
                frame = frame.reset_index(names=(frame.index.name or "index"))
            return _to_jsonable(frame.to_dict(orient="records"))

        if isinstance(value, pd.Series):
            series = value.copy()
            if isinstance(series.index, pd.MultiIndex):
                frame = series.rename("value").reset_index()
                return _to_jsonable(frame.to_dict(orient="records"))
            return _to_jsonable([{"index": idx, "value": val} for idx, val in series.items()])

        if isinstance(value, pd.Index):
            return _to_jsonable(list(value))
    except Exception:
        return None

    return None


def _to_jsonable_numpy(value: Any) -> Any | None:
    try:
        import numpy as np

        if isinstance(value, np.ndarray):
            return _to_jsonable(value.tolist())
        if isinstance(value, np.generic):
            return _to_jsonable(value.item())
    except Exception:
        return None

    return None


def _to_jsonable(value: Any) -> Any:
    """Recursively convert pandas/numpy-rich values into JSON-serializable payloads."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass

    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(v) for v in value]

    pandas_converted = _to_jsonable_pandas(value)
    if pandas_converted is not None:
        return pandas_converted

    numpy_converted = _to_jsonable_numpy(value)
    if numpy_converted is not None:
        return numpy_converted

    return str(value)


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

    graph = Parser.parse_workflow_graph(payload)
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

    # CollectResult 无 output_sockets 时 format_output 会把 (tuple,) 原样返回；
    # 单收集节点时等价于 ([merged_list],)，此处展平为 merged_list，便于 JSON 与前端遍历。
    if len(collected_values) == 1:
        only = collected_values[0]
        if isinstance(only, tuple) and len(only) == 1:
            return only[0]
        return only

    return collected_values


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
) -> EvaluationRunRecord:
    started_at = datetime.now(timezone.utc)

    factor = get_factor(factor_id)

    exec_ctx: dict[str, Any] = {"factor": factor}

    executor = WorkflowExecutor()

    try:
        node_results = executor.execute(profile.workflow, context=exec_ctx)
        collected_result = _extract_collected_result(
            profile.workflow, node_results, collect_node_type=CollectResult
        )
        final_result = _to_jsonable(collected_result)
    except ValueError as e:
        return EvaluationRunRecord(
            start_at=started_at,
            end_at=datetime.now(timezone.utc),
            factor_id=factor_id,
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return EvaluationRunRecord(
            start_at=started_at,
            end_at=datetime.now(timezone.utc),
            factor_id=factor_id,
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
        )

    return EvaluationRunRecord(
        start_at=started_at,
        end_at=datetime.now(timezone.utc),
        factor_id=factor_id,
        evaluation_profile_id=profile.id,
        results=final_result,
    )
