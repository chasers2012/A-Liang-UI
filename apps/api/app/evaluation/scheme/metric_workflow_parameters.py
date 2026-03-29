"""Evaluation-metric rules for ``workflow_parameters`` (reserved keys, etc.)."""

from __future__ import annotations

from workflow import NodeParamModel, validate_node_param_list

RESERVED_METRIC_WORKFLOW_PARAM_KEYS = frozenset({"quantiles", "clean_factor"})


def validate_metric_workflow_parameters(items: list[NodeParamModel]) -> None:
    validate_node_param_list(items)
    for p in items:
        if p.key in RESERVED_METRIC_WORKFLOW_PARAM_KEYS:
            raise ValueError(f"参数 key {p.key!r} 为运行期保留，不可使用")
